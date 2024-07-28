var mongoose=require("mongoose");
// mongoose.connect("mongodb://127.0.0.1:27017/ddbase").then(()=>{
//   console.log('connected!')
// })

const questionSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    trim: true
  },
  notes: {
    type: String,
    required: true,
    trim: true
  },
  question: {
    type: String,
    required: true,
    trim: true
  },
  link: {
    type: String,
    trim: true,
    validate: { // URL validation using a regular expression
      validator: function(v) {
        return /^(ftp|http|https):\/\/[^ "]+$/.test(v);
      },
      message: props => `${props.value} is not a valid URL!`
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true // Ensures a valid user ID
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports=mongoose.model("question",questionSchema);