var express = require('express');
var router = express.Router();
var mongoose = require("mongoose")
var userModel = require("./users");
var question = require("./question")
const passport = require('passport');
var localStrategy = require('passport-local').Strategy;

const DB = 'mongodb+srv://Kuber:Kuber@cluster0.n0oisen.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(DB).then(() => {
    console.log('connection successful');
}).catch((err) => console.log(err));


// Initialize Passport.js
passport.use(new localStrategy(userModel.authenticate()));
passport.serializeUser(userModel.serializeUser());
passport.deserializeUser(userModel.deserializeUser());

// Middleware to check if the user is authenticated
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next(); // Continue to the next middleware or route handler
    } else {
        res.redirect('/'); // Redirect to the home page or login page
    }
}

// Routes
router.get('/', function (req, res, next) {
    res.render('index', { title: 'Express' });
});

router.get('/admin', isLoggedIn, function (req, res, next) {
    res.render('admin', { title: 'Express' });
});

router.post('/done', isLoggedIn,async function (req, res, next) {
    try{
    var data = new question({
        category: req.body.category.trim(),
        question: req.body.question.trim(),
        notes: req.body.notes.trim(),
        link: req.body.link.trim(),
        createdBy: req.user._id 
    })
    const savedQuestion = await data.save();

    // Render the 'done' view with the saved data
    res.render('done', { data: savedQuestion,error:"null" });
    } catch (err) {
        // Handle validation errors or other errors
        console.error(err); // Log the error for debugging
    
        let errorMessage;
        if (err.name === 'ValidationError') {
          const messages = [];
          for (const field in err.errors) {
            messages.push(err.errors[field].message);
          }
          errorMessage = messages.join(', '); // Combine validation errors
        } else {
          errorMessage = "An unexpected error occurred. Please try again later.";
        }
    
        // Include the error message in the rendered view data
        res.render('done', { error: errorMessage });
      }
});

router.get('/profile', isLoggedIn, async function (req, res, next) {
    try {
        // Retrieve user information
        const userId = req.session.passport.user;
        const foundUser = await userModel.findOne({ username: userId });
        // Filter questions by user (assuming `createdBy` field in question schema)
        const userQuestions = await question.find({ createdBy: foundUser._id });

        // Get distinct categories from user's questions
        const categories = userQuestions.length > 0 ? await question.distinct('category', { createdBy: foundUser._id }) : [];
            // console.log(categories);
        // Render profile with user data and questions
        res.render('profile', { user: foundUser, categories: categories });
    } catch (error) {
        console.error('Error:', error);

        // Render the 'error.ejs' template with an error message
        res.render('error', { errorMessage: 'An error occurred. Please try again later.' });
    }
});

  

router.get('/data/:elem', isLoggedIn, async function (req, res, next) {
    const elem = req.params.elem;
    const username = req.session.passport.user; // Adjust based on your session structure
  
    try {
      // Find user by username
      const user = await userModel.findByUsername(username);
  
      // Check if user is found
      if (!user) {
        return res.status(401).send('Unauthorized: User not found.');
      }
  
      // Retrieve user ID
      const userId = user._id;
  
      // Filter questions by category and user ID
      const foundQuestions = await question.find({ 
        category: elem, 
        createdBy: userId 
      });
  
      if (foundQuestions.length > 0) {
        res.render('p1', { data: foundQuestions, category: elem });
      } else {
        res.send('No questions found in this category for this user.');
      }
    } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Internal Server Error');
    }
  });
  
router.get('/delete/:elem', isLoggedIn, async function (req, res, next) {
    try {
        const { elem } = req.params;
        const deletedQuestion = await question.findOneAndDelete({ _id: elem });

        let redirectRoute = '/profile';

        if (deletedQuestion) {
            res.redirect(redirectRoute);
        } else {
            return res.status(404).json({ message: 'Question not found' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/register', function (req, res) {
    var newUser = new userModel({
        username: req.body.username,
        email: req.body.email,
        number: req.body.number
    });
    userModel.register(newUser, req.body.password)
        .then(function () {
            passport.authenticate('local')(req, res, function () {
                res.redirect('/profile');
            });
        })
        .catch(function (error) {
            // Render the same page with the error message included
            res.render('not register', { error: error.message });
        });
});



router.post('/login', passport.authenticate('local', {
    // console.log("hey");
    successRedirect: '/profile',
    failureRedirect: '/'
}));

router.get('/logout', function (req, res, next) {
    req.logout(function(err) {
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
});

router.get('/question', isLoggedIn, async function (req, res, next) {
    var users = await userModel.find({});
    res.send(users)
});

// Define a route to handle picking a random question
router.get('/random-question', isLoggedIn, async function (req, res, next) {
    try {
        // Assuming user ID is stored in session by Passport
        const userId = req.session.passport.user;
        const foundUser = await userModel.findOne({ username: userId });
        console.log('User ID:', foundUser._id);

        // Retrieve a random question from your data source that was created by the current user
        const randomQuestion = await question.aggregate([
            { $match: { createdBy: foundUser._id } }, // Filter by the current user's ID
            { $sample: { size: 1 } } // Randomly sample one document
        ]);

        // Render the random-question.ejs template and pass the random question data to it
        res.render('random-question', { randomQuestion: randomQuestion[0] });
    } catch (error) {
        // Handle errors appropriately
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});


router.post('/search', isLoggedIn, async function(req, res) {
    try {
        const searchQuery = req.body.q; // Retrieve the search query from the request body
        const userId = req.session.passport.user; // Assuming user ID is stored in session by Passport
        const foundUser = await userModel.findOne({ username: userId });
        console.log('Search Query:', searchQuery);
        console.log('User ID:', foundUser._id);

        // Create a regular expression for partial matching
        const regex = new RegExp(searchQuery, 'i'); // 'i' makes the search case-insensitive

        // Perform a search for the search query in the 'question' field of the database using the regex,
        // and ensure the question was created by the current user
        const foundQuestions = await question.find({ question: regex, createdBy: foundUser._id });
        console.log('Found Questions:', foundQuestions);

        res.render('search-results', { questions: foundQuestions });
    } catch (error) {
        console.error('Error during search:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/forgot-password', (req, res) => {
    res.render('forget', { message: null });
});
  
router.post('/forgot', async (req, res) => {
    try {
        const { email } = req.body;
        
        // Check if user with this email exists
        const user = await userModel.findOne({ email });
  
        if (!user) {
            return res.render('forget', { message: 'User with this email does not exist' });
        }
  
        // Generate a random password reset token
        const resetToken = Math.random().toString(36).slice(-8);
  
        // Update user's reset token and expiration time
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
  
        await user.save();
  
        // Send email with reset link
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'kuber8821@gmail.com',
                pass: 'labf npll wsag tvop'
            }
        });
  
        const mailOptions = {
            from: 'kuber8821@gmail.com',
            to: email,
            subject: 'Password Reset Request',
            text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
                    Please click on the following link, or paste this into your browser to complete the process:\n\n
                    http://${req.headers.host}/reset/${resetToken}\n\n
                    If you did not request this, please ignore this email and your password will remain unchanged.\n`
        };
  
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });
  
        res.render('forget', { message: 'Check your email for password reset instructions' });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});
  

// Define the route for this-project
router.get('/this-project', isLoggedIn, function(req, res) {
    try {
        // Render the this-project.ejs template
        res.render('this-project');
    } catch (error) {
        // Handle errors appropriately
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/user-profile', isLoggedIn, async function(req, res) {
    try {
        const userId = req.session.passport.user; // Assuming user ID is stored in session by Passport
        const foundUser = await userModel.findOne({ username: userId });
        if (!foundUser) {
            return res.status(404).send('User not found');
        }

        // Render the user-profile.ejs template and pass the user data to it
        res.render('user-profile', { user: foundUser });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// GET route for edit profile page
router.get('/edit-profile', isLoggedIn, async function(req, res) {
    try {
        // Retrieve the current user's information
        const userId = req.session.passport.user; // Assuming user ID is stored in session by Passport
        const foundUser = await userModel.findOne({ username: userId });
        if (!foundUser) {
            return res.status(404).send('User not found');
        }

        // Render the edit-profile.ejs template and pass the current user's information to it
        res.render('edit-profile', { user: foundUser });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// POST route for updating profile details
router.post('/update-profile', isLoggedIn, async function(req, res) {
    try {
        // Retrieve the updated user details from the form submission
        const { username, email } = req.body;

        // Find the current user in the database and update their details
        const currentUser = req.user; // Assuming user information is stored in req.user
        currentUser.username = username;
        currentUser.email = email;

        // Save the updated user details to the database
        await currentUser.save();

        // Redirect the user to their profile page after updating their details
        res.redirect('/user-profile');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});



module.exports = router;
