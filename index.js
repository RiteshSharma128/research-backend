// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// const mongoose = require("mongoose");

// const app = express();

// app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
// app.use(express.json({ limit: "10mb" }));

// mongoose.connect(process.env.MONGO_URI)
//   .then(() => console.log("✅ MongoDB connected"))
//   .catch(err => console.error("MongoDB error:", err));

// // Routes
// app.use("/api/auth", require("./routes/auth"));
// app.use("/api/research", require("./routes/research"));

// const PORT = process.env.PORT || 5001;
// app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));




// require("dotenv").config();

// const express = require("express");
// const cors = require("cors");
// const mongoose = require("mongoose");
// const cron = require("node-cron");

// const Research = require("./models/Research");

// const app = express();

// // ✅ Middleware
// app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
// app.use(express.json({ limit: "10mb" }));

// // ✅ Routes
// app.use("/api/auth", require("./routes/auth"));
// app.use("/api/research", require("./routes/research"));


// // ✅ 🔥 CRON FUNCTION
// function startCron() {
//   console.log("⏰ Cron Started...");

//   cron.schedule("* * * * *", async () => {
//     try {
//       console.log("⏳ Checking scheduled research...");

//       const now = new Date();

//       const due = await Research.find({
//         isScheduled: true,
//         scheduledAt: { $lte: now },
//         report: { $exists: false }
//       });

//       if (due.length === 0) {
//         console.log("😴 No scheduled research found");
//         return;
//       }

//       for (const research of due) {
//         console.log(`🚀 Running research: ${research.query}`);

//         try {
//           // 👉 YAHAN TERA AI / AGENT LOGIC AAYEGA
//           // Example:
//           // const result = await runResearchAgent(research.query);

//           // Dummy response (test ke liye)
//           research.report = {
//             content: `Auto generated report for: ${research.query}`,
//             createdAt: new Date()
//           };

//           research.isScheduled = false;

//           await research.save();

//           console.log(`✅ Completed: ${research.query}`);
//         } catch (innerErr) {
//           console.error("❌ Research run error:", innerErr);
//         }
//       }

//     } catch (err) {
//       console.error("❌ Cron error:", err);
//     }
//   });
// }


// // ✅ MongoDB connect + Cron start
// mongoose.connect(process.env.MONGO_URI)
//   .then(() => {
//     console.log("✅ MongoDB connected");

//     // 👉 CRON yahi se start hoga (BEST PRACTICE)
//     startCron();

//     const PORT = process.env.PORT || 5001;
//     app.listen(PORT, () => {
//       console.log(`🚀 Server running on port ${PORT}`);
//     });
//   })
//   .catch(err => console.error("MongoDB error:", err));










require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const cron = require("node-cron");
const Research = require("./models/Research");
const { searchAgent, analyzerAgent, factCheckerAgent, reportWriterAgent } = require("./agents");

const app = express();

// ✅ Middleware
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "10mb" }));

// ✅ Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/research", require("./routes/research"));

// ============================
// ✅ CRON FUNCTION
// ============================
function startCron() {
  console.log("⏰ Cron Started...");

  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      // ✅ Fix — report check hatao
      const due = await Research.find({
        isScheduled: true,
        scheduledAt: { $lte: now },
      });

      if (due.length === 0) {
        console.log("😴 No scheduled research found");
        return;
      }

      for (const research of due) {
        console.log(`🔬 Running scheduled: ${research.query}`);

        try {
          // ✅ isScheduled false karo pehle — dobara na chale
          research.isScheduled = false;
          await research.save();

          // ✅ Real AI agents run karo
          const { results: searchResults } = await searchAgent(
            research.query,
            (p) => console.log(`  [search] ${p.message || ""}`)
          );

          const analysis = await analyzerAgent(
            research.query,
            searchResults,
            (p) => console.log(`  [analyzer] ${p.message || ""}`)
          );

          const factCheck = await factCheckerAgent(
            research.query,
            analysis,
            (p) => console.log(`  [factcheck] ${p.message || ""}`)
          );

          const report = await reportWriterAgent(
            research.query,
            analysis,
            factCheck,
            searchResults,
            (p) => console.log(`  [writer] ${p.message || ""}`)
          );

          // ✅ Save report
          research.report = report;
          research.sources = searchResults.map(r => ({
            title: r.title,
            url: r.url,
            content: r.content
          }));
          research.factCheck = factCheck;
          research.reliabilityScore = factCheck.reliabilityScore || 75;
          await research.save();

          console.log(`✅ Scheduled research complete: ${research.query}`);

        } catch (innerErr) {
          console.error(`❌ Research run error: ${research.query}`, innerErr);
          // ✅ Error pe isScheduled wapas true karo retry ke liye
          research.isScheduled = false;
          await research.save();
        }
      }

    } catch (err) {
      console.error("❌ Cron error:", err);
    }
  });
}

// ============================
// ✅ MongoDB + Server Start
// ============================
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    startCron();
    const PORT = process.env.PORT || 5001;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => console.error("MongoDB error:", err));