const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  groupID:{
    type:String
  },
});

const ActivitySchema = new mongoose.Schema({
  month:{
    type:String
  },
  date:{
    type:String
  },
  data:[{
    area:{
      type: String,
    },
    count:{
      type: String,
    }
  }],
  shaker: {
    type: Boolean,
    default: false,
  }
});

const UserSchema = new mongoose.Schema({
  lineID:{ 
    type: String,
    require: true,
  },
  password:{
    type: String,
    maxlength:20,
  },
  razupaiID:{
    type: String,
    maxlength:20,
  },
  groupID:[{
    type: String,
    default:[],
  }],
  session:{
    type: Number,
    default:0,
  },
  Activity: [ActivitySchema],
});

module.exports = [mongoose.model("User",UserSchema),mongoose.model("Group",GroupSchema)]
