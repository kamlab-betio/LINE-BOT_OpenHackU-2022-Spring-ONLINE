// express関連
//const https = require("https");
const line = require('@line/bot-sdk');
const express = require("express");
const app = express();
const PORT = 3000;

// LINE関連
const channelSecret = process.env['channelSecret']; // 認証用のチャンネルシークレット

const message = require('./message.js');
const db = require('./database.js');

const cron = require('node-cron');

const request = require('request')

// expressの設定
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

app.get("/", (req, res) => {
  res.sendStatus(200);
});

// LINEからのメッセージを受け取る
app.post("/", async (req, res) => {
  // 署名を検証
  if (line.validateSignature(JSON.stringify(req.body), channelSecret,
    req.headers['x-line-signature']) == false) {
    res.sendStatus(400);
    console.log("signature NG");
    return;
  }
  res.sendStatus(200);
  console.log("signature OK");

  let events_length = req.body.events.length;
  for (let count = 0; count < events_length; count++) {
    const event = req.body.events[count];
    //console.log(event);  //コンソール
    //個人のトーク画面で行われたこと(友達登録を含む)
    if (event.source.type == "user") {
      var userSession = await db.getSession(event.source.userId);
      // イベントのタイプで分岐
      switch (event.type) {
        case "postback":
          var result = event.postback.data.split('=');
          //データの内容で分岐
          switch (result[0]) {
            case "shakingTime":
              decideAction(event, userSession, [6], async () => {
                await shackerOn(event, result[1]);
                db.pushShakerData(event.source.userId);
                db.setSession(event.source.userId, 1);
              });
              break;
            case "trainingArea":
              decideAction(event, userSession, [2], () => {
                db.pushTrainingArea(event.source.userId, result[1]);
                message.showConfirmArea(event.replyToken, result[1]);
                db.setSession(event.source.userId, 3);
              });
              break;
            case "trainingAreaConfirm":
              decideAction(event, userSession, [3], () => {
                if (result[1] == 'yes') {
                  message.sendSimpleReply(event.replyToken,
                    '筋トレした回数を\"半角数字\"で入力してください');
                  db.setSession(event.source.userId, 4);
                } else {
                  db.popTrainingArea(event.source.userId);
                  message.showButtonTrainingArea(event.replyToken);
                  db.setSession(event.source.userId, 2);
                }
              });
              break;
            case "trainingCountConfirm":
              decideAction(event, userSession, [5], () => {
                if (result[1] == 'yes') {
                  db.mergeTrainingData(event.source.userId);
                  message.sendSimpleReply(event.replyToken, '保存しました');
                  db.setSession(event.source.userId, 1);
                } else {
                  message.sendSimpleReply(event.replyToken, '筋トレした回数を\"半角数字\"で入力してください');
                  db.setSession(event.source.userId, 4);
                }
              });
              break;
            case "raspiIdConfirm":
              decideAction(event, userSession, [-2], () => {
                if (result[1] == 'yes') {
                  message.sendSimpleReply(event.replyToken, '保存しました!\n💪筋トレを始めましょう！💪');
                  db.setSession(event.source.userId, 1);
                } else {
                  message.sendSimpleReply(event.replyToken, '使用するシェイカーのIDを入力してください');
                  db.setSession(event.source.userId, 0);
                }
              });
              break;
          }
          break;
        case "message":
          // メッセージの内容で分岐
          switch (event.message.text) {
            case "シェイカー起動":
              decideAction(event, userSession, [1, 2, 6], () => {
                db.setSession(event.source.userId, 6);
                message.showButtonShacker(event.replyToken);
              });
              break;
            case "筋トレの記録":
              decideAction(event, userSession, [1, 2, 3, 6], () => {
                message.showButtonTrainingArea(event.replyToken);
                db.setSession(event.source.userId, 2);
              });
              break;
            case "使用方法":
              decideAction(event, 0, [0], () => {
                const text = "🏋️〜このBOTの使い方〜🏋️‍♀️\n\n🫙シェイカー起動🫙\nこのボタンを押すと、シェイカーを起動することができます。\n画面の表示に合わせてシェイクする秒数を選択してください。\n\n📝筋トレの記録📝\nトレーニングをしたら記録をしましょう！\n画面の表示に合わせて部位を選択し、カウント数を入力します。\n\n📆カレンダー📆\n今週の筋トレの有無を表示することができます。\nグループに参加していると、グループメンバーの記録も見ることができます。\n\n💪参考動画💪\n腕立て伏せ\nhttps://youtu.be/5xaETaFw1HI";
                message.sendSimpleReply(event.replyToken, text);
              });
              break;
            case "ts_セッション初期化":
              db.setSession(event.source.userId, 1);
              message.sendSimpleReply(event.replyToken, 'セッション番号を1にしました');
              break;
            case "ts_セッション番号取得":
              message.sendSimpleReply(event.replyToken, 'セッション番号:' + userSession);
              break;
            case "カレンダー表示":
              decideAction(event, userSession, [1, 2, 3, 4, 5, 6], () => {
                message.makeCalender(event.replyToken, event.source.userId);
              });
              break;
            case "id変更":
              decideAction(event, userSession, [1, 2], () => {
                db.setSession(event.source.userId, 0);
                message.sendSimpleReply(event.replyToken, '使用するシェイカーのIDを入力してください');
              });
              break;
            default:
              decideAction(event, userSession, [0, 4], () => {
                if (userSession == 0) {
                  //　ラズパイIDの設定
                  db.raspiIdSetting(event.source.userId, event.message.text);
                  message.showConfirmRaspi(event.replyToken, event.message.text);
                } else {
                  // 筋トレ回数の設定
                  var trainingCount = Number(event.message.text);
                  if (isNaN(trainingCount)) {
                    message.sendSimpleReply(event.replyToken,
                      "筋トレした回数を\"半角数字\"で入力してください");
                  } else {
                    db.pushTrainingCount(event.source.userId, trainingCount);
                    db.setSession(event.source.userId, 5);
                    message.showConfirmCount(event.replyToken, trainingCount);
                  }
                }
              });
              break;
          }
          break;
        case "follow":
          if (userSession == null) {
            await db.addUser(event);
            const text = '登録ありがとうございます！\n使用するシェイカーのIDを入力してください';
            message.sendSimpleReply(event.replyToken, text);
          } else if (userSession == -1) {
            await db.setSession(event.source.userId, 1);
            message.sendSimpleReply(event.replyToken, "おかえりなさい");
          }
          break;
        case "unfollow":
          try {
            await db.deleteUser(event.source.userId);
          } catch (err) {
            console.error(err);
          }
          //db.setSession(event.source.userId, -1); // DBからデータを消したくない場合
          break;
      }
    } else if (event.source.type == "group") {
      db.findOrInsertGroup(event.source.groupId);
      if (event.type == 'message') {
        //グループID取得
        var group = event.source.groupId;
        //グループ内のユーザーID取得 
        var user = event.source.userId;
        //Dbからデータを引っ張ってくる
        let result = await db.getUserData(user);
        if (result) {
          var flg = false;
          //グループセッションの長さを取得して同じのがあるかないか
          for (var i = 0; i < result.groupID.length; i++) {
            if (group == result.groupID[i]) {
              flg = true;
              break;
            }
          }
          if (flg == false) {
            await db.pushGroup(user, group);
          } else {
            console.log("登録ずみ");
          }
        } else {
          //LINE追加
          message.sendSimpleReply(event.replyToken,
            "私を追加し、ユーザー登録を行なってください");
        }
      } else if (event.type == 'memberLeft') {
        const count = event.left.members.length;
        for (let i = 0; i < count; i++) {
          db.deleteGroupId(event.left.members[i].userId, event.source.groupId);
        }
      } else if (event.type == 'memberJoined') {
        message.sendSimpleReply(event.replyToken, "ようこそ！\nグループ内で何か発言するとアカウントにグループが登録されます");
      }
    }
  }
});

// // ユーザー登録フォームをブラウザに渡す
// app.get("/userform/:id", function(req, res) {
//   //console.log(req.params.id);
//   res.cookie('db', req.params.id);
//   res.sendFile(__dirname + '/template/form.html');
// });

// カレンダーページの静的ファイルの設定
app.use("/calender/:id", express.static(__dirname + '/template/calendar'));

// カレンダページをブラウザに渡す
app.get("/calender/:id", function(req, res) {
  res.cookie('db', req.params.id);
  res.sendFile(__dirname + '/template/calendar/calendar.html');
});

// カレンダーページのデータを返す
app.get("/calender/data/:id", async function(req, res) {
  const lineId = await db.findlineId(req.params.id);
  let data = await db.getUserData(lineId);
  if (data) {
    res.set({ 'Access-Control-Allow-Origin': '*' });
    res.send(data.Activity);
  } else {
    res.send(null);
  }
});

// // ユーザー登録フォームからの入力を受けとる
// app.post("/userformsubmit", async function(req, res) {
//   console.log("accessed!");
//   console.log(req.body);
//   try {
//     db.newUserSetting(req);
//     const id = await db.findlineId(req.body.db);
//     message.simplePushText(id, 'データ登録しました!');
//   } catch (err) {
//     res.send('エラーが発生しました');
//     return;
//   }
//   // res.send('送信しました');
//   res.sendFile(__dirname + '/template/result.html');
// });

// 外部からの接続を受け付ける(webサーバーの開始)
app.listen(PORT, () => {
  console.log(`Example app listening at http://localhost:${PORT}`);
});

function decideAction(event, sessionNumber, trueArray, trueFunction) {
  if (trueArray.length == 0) {
    console.log('Pass');
    return;
  }
  if (trueArray.includes(sessionNumber) == true) {
    trueFunction();
  } else {
    switch (sessionNumber) {
      case 0:
        // 登録を完了させてくださいと表示
        message.sendSimpleReply(event.replyToken, '使用するシェイカーのIDを入力してください');
        break;
      case -2:
        // 登録を完了させてくださいと表示
        message.sendSimpleReply(event.replyToken, '入力したシェイカーのIDを確認してください');
        break;
      case 1:
        message.sendSimpleReply(event.replyToken, "下のメニューから操作を選択してください↓");
        break;

      case 3:
        // 筋トレ部位を確認してくださいと表示
        message.sendSimpleReply(event.replyToken, '筋トレした部位を確認してください');
        break;

      case 4:
        // 回数を入力してくださいと表示
        message.sendSimpleReply(event.replyToken,
          '筋トレした回数を\"半角数字\"で入力してください');
        break;

      case 5:
        //　筋トレ時間確認ダイアログを再送
        message.sendSimpleReply(event.replyToken, '筋トレした回数を確認してください');
        break;

      case null:
        message.sendSimpleReply(event.replyToken,
          'データがありません。\n友だち登録を解除し、登録をやり直してください');
        break;

      default:
        message.sendSimpleReply(event.replyToken, 'エラーです');
        break;
    }
  }
}

// シェイカー起動
async function shackerOn(event, time) {
  const userData = await db.getUserData(event.source.userId);
  const raspiId = userData.razupaiID;
  let text;
  // let disptime;
  /*
  if(time == 0.1){
    disptime = 10;
  }else if(time == 0.2){
    disptime = 20;
  }else{
    disptime = 30;
  }*/
  
  if(raspiId == 'downhill'){
    text = `起動時間を${time}秒間に設定しました。\nシェイカーが起動します。\n⚠️ケガにご注意ください⚠️`;
    message.sendSimpleReply(event.replyToken, text);
    return;
  }
  request.post({
    url: `https://${raspiId}.loca.lt`,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ moveTime: time })
  }, (err, res, body) =>{
    //console.log(body);
    if(body == "NG"){
      text = '⚠️シェイカー起動中です⚠️\n終了までお待ちください。';
    }else if(body == "OK"){
      text = `起動時間を${time}秒間に設定しました。\nシェイカーが起動します。\n⚠️ケガにご注意ください⚠️`;
    }else{
      text = 'シェイカーにアクセスできません';
    }
    message.sendSimpleReply(event.replyToken, text);
  });
}

async function groupNotice(){
  // グループの一覧を取得
  const groups = await db.getGroupList();
  //console.log(groups);
  let todayData;
  let i;
  for (i = 0; i < groups.length; i++) {
    if (groups[i].groupID == null){
      console.log("group null");
      continue;
    }
    var members = await db.getMembers(groups[i].groupID);
    var tmp;
    var activeUser = [];
    for (var j = 0; j < members.length; j++) {
      tmp = await db.getUserData(members[j].lineID);
      todayData = db.findTodaysData(tmp);
      if (todayData != null) {
        activeUser.push(members[j].lineID);
      }
    }
    try{
      await message.pushGroupActivity(groups[i].groupID, activeUser);
    }catch(err){
      console.error("エラー");
    }finally{
      console.log("グループ。送信しました");
    }
  }
}

cron.schedule('0 13 * * *', groupNotice);
