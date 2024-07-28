
var mongoose=require("mongoose");
var pla=require('passport-local-mongoose');
// mongoose.connect("mongodb://127.0.0.1:27017/ddbase");

var userSchema = mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
   password:String,
   email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
   number:Number,
   questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Question"
  }]
});

userSchema.plugin(pla);
module.exports=mongoose.model("user",userSchema);

  
