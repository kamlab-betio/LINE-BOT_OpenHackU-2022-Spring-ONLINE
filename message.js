const line = require('@line/bot-sdk');
const db = require('./database.js');
const accessToken = process.env['accessToken']; //Messaging APIのアクセストークン
const client = new line.Client({
  channelAccessToken: accessToken
});

function sendSimpleReply(token, messageText) {
  const message = {
    type: 'text',
    text: messageText
  };
  client.replyMessage(token, message);
}

async function showButtonShacker(token) {
  const message = {
    type: 'template',
    altText: 'シェイカー動作時間指定ボタン',
    template: {
      type: 'buttons',
      text: '作動時間は？',
      actions: [
        {
          type: 'postback',
          label: '10秒',
          displayText: '10秒シェイクします',
          data: 'shakingTime=10'
        },
        {
          type: 'postback',
          label: '20秒',
          displayText: '20秒シェイクします',
          data: 'shakingTime=20'
        },
        {
          type: 'postback',
          label: '30秒',
          displayText: '30秒シェイクします',
          data: 'shakingTime=30'
        }
      ]
    }
  };
  client.replyMessage(token, message);
}

async function showButtonTrainingArea(token) {
  const message = {
    type: 'template',
    altText: '筋トレ部位の選択',
    template: {
      type: 'buttons',
      text: '筋トレした部位を選択してください',
      actions: [
        {
          type: 'postback',
          label: '腕',
          displayText: '腕',
          data: 'trainingArea=腕'
        },
        {
          type: 'postback',
          label: '腹筋',
          displayText: '腹筋',
          data: 'trainingArea=腹筋'
        },
        {
          type: 'postback',
          label: '足',
          displayText: '足',
          data: 'trainingArea=足'
        },
        {
          type: 'postback',
          label: '胸',
          displayText: '胸',
          data: 'trainingArea=胸'
        }
      ]
    }
  };
  client.replyMessage(token, message)
}

async function showConfirmArea(token, area) {
  const message = {
    type: 'template',
    altText: `筋トレした部位は「${area}」でよろしいですか？`,
    template: {
      type: 'confirm',
      text: `筋トレした部位は「${area}」でよろしいですか？`,
      actions: [
        {
          type: 'postback',
          label: 'はい',
          displayText: 'はい',
          inputOption: 'openKeyboard',
          data: 'trainingAreaConfirm=yes'
        },
        {
          type: 'postback',
          label: '修正する',
          displayText: '修正する',
          data: 'trainingAreaConfirm=no'
        }
      ]
    }
  };
  client.replyMessage(token, message)
}

async function showConfirmCount(token, num) {
  const message = {
    type: 'template',
    altText: `筋トレした回数は ${num}回 でよろしいですか？`,
    template: {
      type: 'confirm',
      text: `筋トレした回数は ${num}回 でよろしいですか？`,
      actions: [
        {
          type: 'postback',
          label: 'はい',
          displayText: 'はい',
          inputOption: 'openRichMenu',
          data: 'trainingCountConfirm=yes'
        },
        {
          type: 'postback',
          label: '修正する',
          displayText: '修正する',
          data: 'trainingCountConfirm=no'
        }
      ]
    }
  };
  client.replyMessage(token, message)
}

async function makeCalender(token, lineId) {
  const fs = require('fs');
  ////////////////////////////////////////////////////////
  // jsonの読み込み
  const json = fs.readFileSync('./line-flex-message.json')
  // JSON形式からObject型に変換
  let data = JSON.parse(json);
  ////////////////////////////////////////////////////////

  // 日付の取得
  ////////////////////////////////////
  let today = new Date();
  today.setHours(today.getHours() + 9);
  // 月を取得し文字列に変換
  var month = String(today.getMonth() + 1);
  // 日にちを取得し文字列に変換
  const to_day = today.getDate() + 1;
  var day = today.getDate();
  var base_day = 0;
  var day_count = 0;
  ////////////////////////////////////

  

  // データの更新
  ////////////////////////////////////////////////////////////////////
  // data(json)の中身の更新(月)
  data.contents.body.contents[0].contents[0].text = month + "月";

  // data(json)の中身の更新(日)
  // 月、日の個数(配列の長さ)の取得: 15
  var contents_length = data.contents.body.contents[0].contents.length;

  // 表示する日付を決めるアルゴリズム
  if (Math.floor(to_day / 7) == 0) {
    base_day = 1;
  } else if (Math.floor(to_day / 7) == 1) {
    base_day = 6;
  } else if (Math.floor(to_day / 7) == 2) {
    base_day = 13;
  } else if (Math.floor(to_day / 7) == 3) {
    base_day = 20;
  } else if (Math.floor(to_day / 7) == 4) {
    base_day = 27;
  }
  
  for (let i = 1; i < contents_length; i++) {
    // data.messages[0].contents.body.contents[0].contents[i].text
    // は15項目のうち偶数番目の項目にしか存在しないためi % 2 == 0を条件式としている
    if (i % 2 == 0) {
      // カレンダー表示に伴い、base_dayから１日ずつ増やしながら表示している
      day = base_day + day_count;
      data.contents.body.contents[0].contents[i].text = String(day);
      day_count += 1
    }
  }
  //　カレンダーの仕切り線と名前と○×の部分をテンプレートとしてコピー
  const TEMPLATE = JSON.parse(JSON.stringify(data.contents.body.contents.slice(1,4)));

  // 表示するべきメンバーのデータ一覧を取得
  const MENBER_LIST = await db.getMates(lineId);
  //console.log(MENBER_LIST);
  let m = 0;
  while(true){
     // ユーザー名の更新
    data.contents.body.contents[(3*m) + 2].contents[0].text 
      = (await client.getProfile(MENBER_LIST[m].lineID)).displayName;
    
    // ◯×の判定
    for (let n = 0; n < 7; n++) {
      var flg = false;
      // 明日以降の日付
      if((base_day + n) > (to_day - 1)){
        data.contents.body.contents[(3*m) +3].contents[(2 * n) + 2].text = "-";
        continue;
      }
      // データがある場合
      for (let j = 0; j < MENBER_LIST[m].Activity.length; j++) {
        if ((MENBER_LIST[m].Activity[j].month == month) 
            && (MENBER_LIST[m].Activity[j].date == (base_day + n))) {
          data.contents.body.contents[(3*m) +3].contents[(2 * n) + 2].text = "○";
          flg = true;
          break;
        }
      }
      // データがない場合
      if (!flg) {
        data.contents.body.contents[(3*m) +3].contents[(2 * n) + 2].text = "×";
      }
    }
    m++;
    if(m < MENBER_LIST.length){
      data.contents.body.contents 
        = data.contents.body.contents.concat(JSON.parse(JSON.stringify(TEMPLATE)));
    }else{
      break;
    }
  }
  
  //詳細データ用のurlを追加
  data.contents.footer.contents[0].action.uri 
    = "https://Shacker-Backend.sen-95.repl.co/calender/" + MENBER_LIST[0]._id;
  data.contents.footer.action.uri = "https://Shacker-Backend.sen-95.repl.co/calender/" + MENBER_LIST[0]._id;

  try {
    await client.replyMessage(token, data);
  } catch (err) {
    console.log(err);
  }
}

function simplePushText(to, text){
  const message = {
    type: 'text',
    text: text
  };
  client.pushMessage(to, message)
}

async function pushGroupActivity(to, users){
  if(users.length == 0){
    var text = '今日、このグループで筋トレをした人はいませんでした\n明日は元気に筋トレしましょう！';
  }else{
    var text = '今日このグループで筋トレをした人は、\n';
    for(let i = 0; i < users.length; i++){
      text += (await client.getProfile(users[i])).displayName + 'さん\n';
    }
    text += 'です！\n明日も元気に筋トレしましょう！';
  }
  simplePushText(to, text);
}

async function getUserName(Id){
  return (await client.getProfile(Id)).displayName;
}

async function showConfirmRaspi(token, raspiId) {
  const message = {
    type: 'template',
    altText: `シェイカーのIDは「${raspiId}」でよろしいですか？`,
    template: {
      type: 'confirm',
      text: `シェイカーのIDは「${raspiId}」でよろしいですか？`,
      actions: [
        {
          type: 'postback',
          label: 'はい',
          displayText: 'はい',
          data: 'raspiIdConfirm=yes'
        },
        {
          type: 'postback',
          label: '修正する',
          displayText: '修正する',
          data: 'raspiIdConfirm=no'
        }
      ]
    }
  };
  client.replyMessage(token, message)
}

module.exports = {sendSimpleReply, showButtonShacker, showButtonTrainingArea, showConfirmArea, showConfirmCount, makeCalender, simplePushText, pushGroupActivity, getUserName, showConfirmRaspi};
