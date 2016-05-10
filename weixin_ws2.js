/**
  上一个例子的微信墙没有获得用户头像、名字等信息
  这些信息要通过另一类微信API，也就是由服务器主动调用微信获得
  这一类API的安全机制不同于之前，不再通过简单的TOKEN校验
  而需要通过appID、appSecret获得access_token，然后再用
  access_token获取相应的数据

  可以先看以下代码：
  lib/config.js - appID和appSecret配置
  lib/token.js  - 获得有效token
  lib/user.js   - 获得用户信息
  lib/reply.js  - 回复微信的模板
  lib/ws.js     - 简单的websocket
*/

var PORT = require('./lib/config').wxPort;

var http = require('http');
var qs = require('qs');
var TOKEN = 'helpme';

var express =  require('express');
var path = require('path');

//express实例
var app = express();

//定义EJS模板引擎和模板文件位置

app.set('views',path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

//定义静态文件目录
app.use(express.static(path.join(__dirname, 'assets')));

var getUserInfo = require('./lib/user').getUserInfo;
var replyText = require('./lib/reply').replyText; 

var wss = require('./lib/ws.js').wss;

function checkSignature(params, token){
  //1. 将token、timestamp、nonce三个参数进行字典序排序
  //2. 将三个参数字符串拼接成一个字符串进行sha1加密
  //3. 开发者获得加密后的字符串可与signature对比，标识该请求来源于微信

  var key = [token, params.timestamp, params.nonce].sort().join('');
  var sha1 = require('crypto').createHash('sha1');
  sha1.update(key);
  
  return  sha1.digest('hex') == params.signature;
}

var server = http.createServer(function (request, response) {

  //解析URL中的query部分，用qs模块(npm install qs)将query解析成json
  var query = require('url').parse(request.url).query;
  var params = qs.parse(query);

  if(!checkSignature(params, TOKEN)){
    //如果签名不对，结束请求并返回
    response.end('signature fail');
    return;
  }

  if(request.method == "GET"){
    //如果请求是GET，返回echostr用于通过服务器有效校验
    response.end(params.echostr);
  }else{
    //否则是微信给开发者服务器的POST请求
    var postdata = "";

    request.addListener("data",function(postchunk){
        postdata += postchunk;
    });

    //获取到了POST数据
    request.addListener("end",function(){
      var parseString = require('xml2js').parseString;
      
      console.log(postdata);
      parseString(postdata, function (err, result) {
        if(!err){
	  console.log(result);
          if(result.xml.MsgType[0] === 'text'){
            getUserInfo(result.xml.FromUserName[0])
            .then(function(userInfo){
              //获得用户信息，合并到消息中
              result.user = userInfo;
              //将消息通过websocket广播
              wss.broadcast(result);
              var res = replyText(result, '文字消息已经成功上墙！');
              response.end(res);
            })
          } else if(result.xml.MsgType[0] === 'image'){
            getUserInfo(result.xml.FromUserName[0])
                .then(function(userInfo){
              //获得用户信息，合并到消息中
              result.user = userInfo;
              //将消息通过websocket广播
              wss.broadcast(result);
              var res = replyText(result, '图片消息已经成功上墙！');
              response.end(res);
                })
          }else if(result.xml.MsgType[0] === 'voice'){
                  var res = replyText(result, '接收到语音消息，暂不支持上墙');
                  response.end(res);
          }else if(result.xml.MsgType[0] === 'video'){
                  var res = replyText(result, '接收到视频消息，暂不支持上墙');
                  response.end(res);
          }else if(result.xml.MsgType[0] === 'shortvideo'){
                  var res = replyText(result, '接收到小视频消息，暂不支持上墙');
                  response.end(res);
          }else if(result.xml.MsgType[0] === 'location'){
            var res = replyText(result, '接收到地理位置消息，暂不支持上墙');
            response.end(res);
          }else if(result.xml.MsgType[0] === 'link'){
            var res = replyText(result, '接收到链接消息，暂不支持上墙');
            response.end(res);
          }
        }
      });
    });
  }
});

server.listen(PORT);

app.get('/',function(req,res){
    res.render('test_weixinqiang',{

    });
})

app.listen(8888, function(req, res){
   console.log('app is running at port 8888');
});
console.log("Weixin server runing at port: " + PORT + ".");
