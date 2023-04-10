//mongooseの設定
const mongoose = require("mongoose");
const MongoClient = require('mongodb').MongoClient;
const mongo_username = process.env['MONGO_USERNAME'];
const mongo_password = process.env['MONGO_PASSWORD'];
const MODELS = require('./models.js');
const User = MODELS[0];
const Group = MODELS[1];
mongoose.set('strictQuery', true);

// データベース接続
mongoose.connect(`mongodb+srv://${mongo_username}:${mongo_password}@cluster0.zy3gcna.mongodb.net/shakers?retryWrites=true&w=majority`).then(() => console.log("db connected")).catch((error) => console.log(error));

async function pushTrainingArea(lineId, Area) {
  let today = new Date();
  today.setHours(today.getHours() + 9);
  let result = await User.findOne({ lineID: lineId });

  let flg = false, i;
  for (i = 0; i < result.Activity.length; i++) {
    if ((result.Activity[i].month == (today.getMonth() + 1))
      && (result.Activity[i].date == today.getDate())) {
      flg = true;
      break;
    }
  }
  
  if (flg) {
    await User.updateOne({ lineID: lineId },
      { $push: { [`Activity.${i}.data`]: { area: Area, count: '0' } } });
  } else {
    const newdata = {
      month: (today.getMonth() + 1),
      date: today.getDate(),
      data: [{ area: Area, count: '0' }],
      shaker:false
    }
    await User.updateOne({ lineID: lineId }, { $push: { Activity: newdata } });
  }
}

async function popTrainingArea(lineId) {
  let today = new Date();
  today.setHours(today.getHours() + 9);
  let result = await User.findOne({ lineID: lineId });

  let flg = false, i;
  for (i = 0; i < result.Activity.length; i++) {
    if ((result.Activity[i].month == (today.getMonth() + 1))
      && (result.Activity[i].date == today.getDate())) {
      flg = true;
      break;
    }
  }
  if (flg) {
    await User.updateOne({ lineID: lineId }, { $pop: [`Activity.${i}.data`] });
  } else {
    throw "today's data is not found";
  }
}

async function pushTrainingCount(lineId, num) {
  let today = new Date();
  today.setHours(today.getHours() + 9);
  var result = await User.findOne({ lineID: lineId });

  let flg = false, i;
  for (i = 0; i < result.Activity.length; i++) {
    if ((result.Activity[i].month == (today.getMonth() + 1))
      && (result.Activity[i].date == today.getDate())) {
      flg = true;
      break;
    }
  }

  if (flg) {
    //今日の活動データ
    let lastData = result.Activity[i].data.length - 1;
    await User.updateOne({ lineID: lineId }, { $set: { [`Activity.${i}.data.${lastData}.count`]: num } });
  } else {
    throw "today's data is not found";
  }
}

function findTodaysData(data){
  let today = new Date();
  today.setHours(today.getHours() + 9);
  let flg = false;
  let i = 0;
  for (i = 0; i < data.Activity.length; i++) {
    if ((data.Activity[i].month == (today.getMonth() + 1))
      && (data.Activity[i].date == today.getDate())) {
      flg = true;
      break;
    }
  }
  if(flg){
    return i;
  }else{
    return null;
  }
}

async function mergeTrainingData(lineId) {
  let today = new Date();
  today.setHours(today.getHours() + 9);
  var result = await User.findOne({ lineID: lineId });

  const i = findTodaysData(result);
  // let flg = false, i;
  // for (i = 0; i < result.Activity.length; i++) {
  //   if ((result.Activity[i].month == (today.getMonth() + 1))
  //     && (result.Activity[i].date == today.getDate())) {
  //     flg = true;
  //     break;
  //   }
  // }

  if (i != null) {
    //今日の活動データ
    let lastData = result.Activity[i].data.length - 1;
    for (let j = 0; j < lastData; j++) {
      if (result.Activity[i].data[j].area == result.Activity[i].data[lastData].area) {
        result.Activity[i].data[j].count = (Number(result.Activity[i].data[j].count) + Number(result.Activity[i].data[lastData].count)).toString();
        result.Activity[i].data.pop();
        break;
      }
    }
    await User.updateOne({ lineID: lineId }, { $set: { [`Activity.${i}.data`]: result.Activity[i].data } });
  } else {
    throw "today's data is not found";
  }
}

async function pushShakerData(lineId) {
  let today = new Date();
  today.setHours(today.getHours() + 9);

  // todayの中身(時間)を表示する処理
  // 日付の表示がおかしかったので色々試すのに使っていた。
  // console.log('現在:' + `${today.getFullYear()}年 ${today.getMonth() + 1}月 ${today.getDate()}日${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}:${today.getMilliseconds()}`);
  
  let result = await User.findOne({ lineID: lineId });

  let flg = false, i;
  for (i = 0; i < result.Activity.length; i++) {
    if ((result.Activity[i].month == (today.getMonth() + 1))
      && (result.Activity[i].date == today.getDate())) {
      flg = true;
      break;
    }
  }
  if (flg) {
    console.log('true')
    await User.updateOne({ lineID: lineId },
      { $set: { [`Activity.${i}.shaker`]: true } });
  } else {
    console.log('false')
    const newdata = {
      month: (today.getMonth() + 1),
      date: today.getDate(),
      data: [],
      shaker: true
    }
    await User.updateOne({ lineID: lineId }, { $push: { Activity: newdata } });
  }
}

async function setSession(lineId, number) {
  await User.updateOne({ lineID: lineId }, { $set: { session: number } });
}

async function addUser(event) {
  //データベースに追加
  const newUser = new User({
    lineID: event.source.userId,
    session: 0
  });
  const newData = await newUser.save();
  return newData._id;
}

async function deleteUser(lineId) {
  await User.deleteOne({ lineID: lineId });
}

// lineのトークIDからユーザーのセッション番号を取得する関数
async function getSession(lineId) {
  // findOneの戻り値はPromiseオブジェクト.
  // 戻り値(ここでは検索結果)を使う前に値の決定の処理を書かなければならない.
  // awaitをつけると値が決定するまで処理を待ってくれる(ように振る舞う)
  const data = await User.findOne({ lineID: lineId });
  if (data == null) {
    return null;
  } else {
    return data.session;
  }
}

// 「データベースのid」からユーザーの「lineのトークID」を取得する関数
// 基本的にユーザー登録の時しか使わないはず
async function findlineId(dbId) {
  const data = await User.findOne({ _id: dbId });
  if (data == null) {
    return null;
  } else {
    return data.lineID;
  }
}

async function getUserData(lineId){
  return await User.findOne({ lineID:lineId });
}

async function raspiIdSetting(lineId, razupaiId){
  try{
    await User.updateOne({ lineID: lineId },
      {
        $set: {
          razupaiID: razupaiId,
          session: -2
        }
      });
  }catch(err){
    console.error("raspiIDSetting Error!");
  }
}

async function pushGroup(lineId, groupId){
  await User.updateOne({ lineID: lineId }, { $push:{groupID:groupId}});
}

async function getMates(lineId){
  //　基準となるユーザーのデータを取得
  const user = await User.findOne({ lineID:lineId },{groupID:1, lineID:1, Activity:1});
  //メンバーリストを作成し、冒頭にユーザー自身を入れる
  let list = [user];
  const mates = await User.find(
    {$and:
      [{groupID:{$elemMatch:{$in:user.groupID}}},{lineID:{$ne:lineId}}]
    },{_id:0, lineID:1, Activity:1}
  );
  list = list.concat(mates);
  return list;
}

async function deleteGroupId(lineId, groupId){
  await User.updateOne({lineID:lineId}, {$pull:{groupID:groupId}});
}

async function getGroupList(){
  return await Group.find();
}

async function findOrInsertGroup(groupId){
  let result = await Group.findOne({ groupID: groupId });
  if(result == null ){
    const newGroup = new Group({
    groupID: groupId
    });
    await newGroup.save();
  }
}

async function getMembers(GROUP_ID){
  //console.log(GROUP_ID);
  const users = await User.find({groupID:{$elemMatch:{$in:GROUP_ID}}}, {_id:0, lineID:1, Activity:1});
  //console.log(users);
  return users;
}

module.exports = {pushTrainingArea, popTrainingArea, pushTrainingCount, mergeTrainingData, pushShakerData, setSession, getSession, getUserData, deleteUser, findlineId, addUser, raspiIdSetting, pushGroup, getMates, deleteGroupId, getGroupList, findOrInsertGroup, getMembers, findTodaysData};
