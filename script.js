const File = require("./models/file");
const fs = require("fs");
const DB = require("./config/db");
DB();

async function fetchData() {
  const pastDate = new Date(Date.now() - 86400000);
  const files = await File.find({
    createdAt: {
      $lt: pastDate,
    },
  });

  if (files.length) {
    for (const file of files) {
      try {
        fs.unlinkSync(file.path);
        await file.remove();
        console.log(`Successfully Deleted ${file.filename}`);
      } catch (error) {
        console.log(`Error while deleting file ${error}`);
      }
    }
    console.log("Deleting Old Files Done!!");
  }
}

fetchData().then(process.exit);
