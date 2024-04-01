const admin = require("firebase-admin");
const fs = require("fs"); // 導入fs模塊

const serviceAccount = require("./test-6f72a-firebase-adminsdk-slyk6-42158157be.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://test-6f72a-default-rtdb.firebaseio.com",
  storageBucket: "test-6f72a.appspot.com",
});

const db = admin.database();
const bucket = admin.storage().bucket();

// 更新用户集點
function updateUserPoints(userId) {
  const ref = db.ref("users/" + userId);
  ref.transaction((currentPoints) => {
    if (currentPoints === null) {
      return 1; // 如果當前沒有點數，則初始化為1
    } else {
      return currentPoints + 1; // 否則集點+1
    }
  });
}

function getUserPoints(userId) {
  return new Promise((resolve, reject) => {
    const ref = db.ref("users/" + userId);
    ref.once(
      "value",
      (snapshot) => {
        const points = snapshot.val();
        resolve(points || 0); // 如果沒有集點，預設為0
      },
      reject
    );
  });
}

// 為每個上傳的圖片創建一個案件紀錄
function uploadImage(filePath, imageName, userId, latitude, longitude) {
  return new Promise((resolve, reject) => {
    const file = bucket.file(imageName);
    const stream = file.createWriteStream({
      metadata: {
        contentType: "image/png",
      },
    });

    stream.on("error", (e) => {
      console.log(e);
      reject(e);
    });

    stream.on("finish", async () => {
      try {
        await file.makePublic(); // 使文件公開
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${imageName}`;

        // 創建案件紀錄
        const caseRecord = {
          imageUrl: publicUrl,
          status: "尚未處理", // 初始狀態為「尚未處理」
          uploadTime: new Date().toISOString(), // 紀錄上傳時間
          userId: userId, // 保存上傳者的 userId
          latitude: latitude,
          longitude: longitude,
        };

        // 將案件紀錄保存到 Realtime Database
        const newCaseRef = db.ref("cases").push(); // 在“cases”下創建新紀錄
        newCaseRef.set(caseRecord);

        resolve(publicUrl); // 返回文件的公開URL
      } catch (error) {
        console.error("上傳失敗", error);
        reject(error);
      }
    });

    fs.createReadStream(filePath).pipe(stream);
  });
}

function getUserCases(userId) {
  return new Promise((resolve, reject) => {
    const casesRef = db.ref("cases").orderByChild("userId").equalTo(userId);
    casesRef.once(
      "value",
      (snapshot) => {
        const cases = snapshot.val();
        if (cases) {
          resolve(Object.values(cases)); // 返回案件紀錄
        } else {
          resolve([]); // 使用者没有案件紀錄
        }
      },
      reject
    );
  });
}

(async () => {
  const source = `{
    "rules": {
      ".read": false,
      ".write": false,
      
      "users": {
        "$userId": {
          ".read": "auth != null && auth.uid == $userId",
          ".write": "auth != null && auth.uid == $userId"
        }
      },

      "cases": {
        "$caseId": {
          ".write": "auth != null && newData.child('userId').val() == auth.uid",
          ".read": "auth != null && data.child('userId').val() == auth.uid"
        }
      }
    }
  }`;

  try {
    await admin.database().setRules(source);
    console.log("Rules set successfully");
  } catch (error) {
    console.error("Error setting rules:", error);
  }
})();

module.exports = { updateUserPoints, getUserPoints, uploadImage, getUserCases };
