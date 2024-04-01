const express = require("express"); //引入Express框架，用於建立web應用的Node.js框架
const multer = require("multer"); //引入Multer中間件，用於處理multipart/form-data類型的表單數據，主要用於上傳檔案
const fs = require("fs"); //引入Node.js的檔案系統模塊，用於讀取和寫入檔案
const exec = require("child_process").exec; //引入child_process模塊的exec方法，允許Node.js執行外部程序(Python)
const { updateUserPoints, uploadImage } = require("./firebase.js"); // 从 firebase.js 导入函数
const { bot, sendMessage } = require("./bot"); //引入bot.js  

const app = express();
const upload = multer({ dest: "uploads/" }); // 設定圖片上傳的目錄

app.post("/webhook", bot.parser()); //使用bot.parser()處理Webhook請求

app.use(express.json());

// 只要到了首頁localhost:8080時，回傳index.html檔案的內容
app.get("/", (req, res) => {
  res.end(fs.readFileSync("index.html", "utf8"));
});

//定義一個POST路由/detect，使用Multer處理名為image_file的單一檔案上傳
app.post("/detect", upload.single("image_file"), async function (req, res) {
  const imageFilePath = req.file.path; //獲取上傳檔案的路徑
  const latitude = req.body.latitude;
  const longitude = req.body.longitude;
  const userId = req.body.userId; //從請求中獲取userId
  
  //如果經緯度為空，直接返回錯誤訊息
  if (!latitude || !longitude) {
    return res.json({ message: "Fail", detail: "無法讀取圖片位置" });
  }
 
  //生成文件名  
  const fileName = `${Date.now()}-${req.file.originalname}`; 
  const imageName = `images/${fileName}`;
  //使用exec方法執行main.py，並將圖片檔案路徑作為輸入
  const pythonProcess = exec("python main.py", function (error, stdout) {
    //如果執行過程發生錯誤，將錯誤輸出
    if (error) {
      console.error("error: " + error);
      res.json({ message: "Error", detail: error.message }); //發生錯誤時發送錯誤詳情
      return;
    }
    if (stdout.trim() === "Success") {
      uploadImage(imageFilePath, imageName, userId, latitude, longitude);
      res.json({ message: "Success", detail: "圖片上傳成功" });
    } else {     
      res.json({ message: "Fail", detail: "圖片不符合標準，請重新上傳" });
    }
  });
  pythonProcess.stdin.write(imageFilePath);
  pythonProcess.stdin.end();
}); 

app.post("/api/save-upload-info", (req, res) => { 
  const { userId } = req.body;
  try {
    updateUserPoints(userId); //調用firebase.js中的函數來更新用戶集點
    sendMessage(userId, "感謝您回報道路狀況，成功集點一次");
    res.status(200).send("已更新積分");
  } catch (error) {
    console.error("紀錄失敗:", error);
    res.status(500).send("伺服器錯誤");
  }
});

//監聽8080端口
app.listen(8080, () => {
  console.log("Server is listening on port 8080");
});
