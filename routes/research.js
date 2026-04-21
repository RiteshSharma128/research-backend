
// code 1 important more feature  
// const express = require("express");
// const router = express.Router();
// const protect = require("../middleware/auth");
// const { searchAgent, analyzerAgent, factCheckerAgent, reportWriterAgent } = require("../agents");
// const Research = require("../models/Research");
// const axios = require("axios");
// const pdfParse = require("pdf-parse");
// const mammoth = require("mammoth");
// const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require("docx");
// const nodemailer = require("nodemailer");


// // ============================
// // MAIN RESEARCH ENDPOINT
// // ============================
// router.post("/stream", protect, async (req, res) => {
//   const { query, urls } = req.body;

//   if (!query) return res.status(400).json({ message: "Query required" });

//   res.setHeader("Content-Type", "text/event-stream");
//   res.setHeader("Cache-Control", "no-cache");
//   res.setHeader("Connection", "keep-alive");
//   res.flushHeaders();

//   const send = (data) => {
//     res.write(`data: ${JSON.stringify(data)}\n\n`);
//   };

//   try {
//     send({ type: "start", message: "Research starting..." });

//     // ============================
//     // AGENT 1 — Search
//     // ============================
//     const { results: searchResults, answer } = await searchAgent(query, (progress) => {
//       send({ type: "agent", ...progress });
//     });

//     // ============================
//     // URL/PDF Analysis (optional)
//     // ============================
//     let extraContent = [];
//     if (urls && urls.length > 0) {
//       send({ type: "agent", agent: "urlanalyzer", status: "running", message: `Analyzing ${urls.length} URLs...` });
//       for (const url of urls) {
//         try {
//           const { data } = await axios.get(url, { timeout: 5000 });
//           extraContent.push({ url, content: data.substring(0, 2000) });
//         } catch {}
//       }
//       send({ type: "agent", agent: "urlanalyzer", status: "done", message: "URLs analyzed" });
//     }

//     // ============================
//     // AGENT 2 — Analyze
//     // ============================
//     const analysis = await analyzerAgent(
//       query,
//       [...searchResults, ...extraContent],
//       (progress) => send({ type: "agent", ...progress })
//     );

//     // ============================
//     // AGENT 3 — Fact Check
//     // ============================
//     const factCheck = await factCheckerAgent(query, analysis, (progress) => {
//       send({ type: "agent", ...progress });
//     });

//     // ============================
//     // AGENT 4 — Write Report
//     // ============================
//     const report = await reportWriterAgent(
//       query, analysis, factCheck, searchResults,
//       (progress) => send({ type: "agent", ...progress })
//     );

//     // ============================
//     // Save to DB
//     // ============================
//     const research = await Research.create({
//       userId: req.user._id,
//       query,
//       report,
//       sources: searchResults.map(r => ({ title: r.title, url: r.url, content: r.content })),
//       factCheck,
//       reliabilityScore: factCheck.reliabilityScore || 75,
//     });

//     send({ type: "done", research });

//   } catch (err) {
//     console.error("Research error:", err);
//     send({ type: "error", message: err.message });
//   } finally {
//     res.end();
//   }
// });

// // ============================
// // GET ALL RESEARCH
// // ============================
// router.get("/", protect, async (req, res) => {
//   try {
//     const researches = await Research.find({ userId: req.user._id })
//       .sort({ createdAt: -1 })
//       .select("-report")
//       .limit(20);
//     res.json({ success: true, researches });
//   } catch {
//     res.status(500).json({ message: "Fetch failed" });
//   }
// });

// // ============================
// // GET SINGLE RESEARCH
// // ============================
// router.get("/:id", protect, async (req, res) => {
//   try {
//     const research = await Research.findOne({
//       _id: req.params.id,
//       userId: req.user._id,
//     });
//     if (!research) return res.status(404).json({ message: "Not found" });
//     res.json({ success: true, research });
//   } catch {
//     res.status(500).json({ message: "Fetch failed" });
//   }
// });

// // ============================
// // DELETE RESEARCH
// // ============================
// router.delete("/:id", protect, async (req, res) => {
//   try {
//     await Research.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
//     res.json({ success: true });
//   } catch {
//     res.status(500).json({ message: "Delete failed" });
//   }
// });

// // ============================
// // CHAT WITH RESEARCH
// // ============================
// router.post("/:id/chat", protect, async (req, res) => {
//   const { message, history } = req.body;

//   try {
//     const research = await Research.findOne({ _id: req.params.id, userId: req.user._id });
//     if (!research) return res.status(404).json({ message: "Not found" });

//     res.setHeader("Content-Type", "text/event-stream");
//     res.setHeader("Cache-Control", "no-cache");
//     res.setHeader("Connection", "keep-alive");
//     res.flushHeaders();

//     const Groq = require("groq-sdk");
//     const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

//     const stream = await groq.chat.completions.create({
//       model: "llama-3.1-8b-instant",
//       messages: [
//         {
//           role: "system",
//           content: `You are a research assistant. Answer questions based on this research report:\n\n${research.report.substring(0, 3000)}`
//         },
//         ...(history || []),
//         { role: "user", content: message }
//       ],
//       stream: true,
//       max_tokens: 500,
//     });

//     for await (const chunk of stream) {
//       const text = chunk.choices[0]?.delta?.content || "";
//       if (text) res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
//     }

//     res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
//     res.end();

//   } catch (err) {
//     res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
//     res.end();
//   }
// });

// // ✅ DOCX Export
// router.get("/:id/export/docx", protect, async (req, res) => {
//   try {
//     const research = await Research.findOne({ _id: req.params.id, userId: req.user._id });
//     if (!research) return res.status(404).json({ message: "Not found" });

//     const lines = research.report.split("\n");
//     const children = [];

//     for (const line of lines) {
//       if (line.startsWith("# ")) {
//         children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
//       } else if (line.startsWith("## ")) {
//         children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
//       } else if (line.startsWith("### ")) {
//         children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
//       } else if (line.trim()) {
//         children.push(new Paragraph({ children: [new TextRun({ text: line.replace(/\*\*/g, "").replace(/\*/g, "") })] }));
//       } else {
//         children.push(new Paragraph({ text: "" }));
//       }
//     }

//     const doc = new Document({ sections: [{ children }] });
//     const buffer = await Packer.toBuffer(doc);

//     res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
//     res.setHeader("Content-Disposition", `attachment; filename="research.docx"`);
//     res.send(buffer);
//   } catch (err) {
//     res.status(500).json({ message: "Export failed" });
//   }
// });


// // ============================
// // AI SUMMARY
// // ============================
// router.post("/:id/summary", protect, async (req, res) => {
//   try {
//     const research = await Research.findOne({ _id: req.params.id, userId: req.user._id });
//     if (!research) return res.status(404).json({ message: "Not found" });

//     const Groq = require("groq-sdk");
//     const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

//     const completion = await groq.chat.completions.create({
//       model: "llama-3.1-8b-instant",
//       messages: [
//         {
//           role: "system",
//           content: "Create a concise 1-page executive summary of the research report. Include key findings, conclusions, and recommendations."
//         },
//         {
//           role: "user",
//           content: `Research: "${research.query}"\n\nReport:\n${research.report.substring(0, 4000)}\n\nCreate a 1-page summary in markdown format.`
//         }
//       ],
//       max_tokens: 800,
//     });

//     const summary = completion.choices[0]?.message?.content || "";
//     research.summary = summary;
//     await research.save();

//     res.json({ success: true, summary });
//   } catch {
//     res.status(500).json({ message: "Summary failed" });
//   }
// });

// // ============================
// // RATING
// // ============================
// router.post("/:id/rate", protect, async (req, res) => {
//   try {
//     const { rating } = req.body;
//     if (!rating || rating < 1 || rating > 5) {
//       return res.status(400).json({ message: "Rating 1-5 hona chahiye" });
//     }
//     const research = await Research.findOneAndUpdate(
//       { _id: req.params.id, userId: req.user._id },
//       { rating },
//       { new: true }
//     );
//     res.json({ success: true, rating: research.rating });
//   } catch {
//     res.status(500).json({ message: "Rating failed" });
//   }
// });

// // ============================
// // BOOKMARKS
// // ============================
// router.post("/:id/bookmark", protect, async (req, res) => {
//   try {
//     const { text, note } = req.body;
//     const research = await Research.findOne({ _id: req.params.id, userId: req.user._id });
//     if (!research) return res.status(404).json({ message: "Not found" });

//     research.bookmarks.push({ text, note });
//     await research.save();

//     res.json({ success: true, bookmarks: research.bookmarks });
//   } catch {
//     res.status(500).json({ message: "Bookmark failed" });
//   }
// });

// router.delete("/:id/bookmark/:bookmarkId", protect, async (req, res) => {
//   try {
//     const research = await Research.findOne({ _id: req.params.id, userId: req.user._id });
//     research.bookmarks = research.bookmarks.filter(
//       b => b._id.toString() !== req.params.bookmarkId
//     );
//     await research.save();
//     res.json({ success: true });
//   } catch {
//     res.status(500).json({ message: "Delete failed" });
//   }
// });

// // ============================
// // MULTI-LANGUAGE
// // ============================
// router.post("/:id/translate", protect, async (req, res) => {
//   try {
//     const { language } = req.body;
//     const research = await Research.findOne({ _id: req.params.id, userId: req.user._id });
//     if (!research) return res.status(404).json({ message: "Not found" });

//     res.setHeader("Content-Type", "text/event-stream");
//     res.setHeader("Cache-Control", "no-cache");
//     res.setHeader("Connection", "keep-alive");
//     res.flushHeaders();

//     const Groq = require("groq-sdk");
//     const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

//     const langMap = {
//       hindi: "Hindi",
//       english: "English",
//       spanish: "Spanish",
//       french: "French",
//     };

//     const stream = await groq.chat.completions.create({
//       model: "llama-3.1-8b-instant",
//       messages: [
//         {
//           role: "system",
//           content: `Translate the following research report to ${langMap[language] || language}. Keep the markdown formatting.`
//         },
//         {
//           role: "user",
//           content: research.report.substring(0, 4000)
//         }
//       ],
//       stream: true,
//       max_tokens: 3000,
//     });

//     let translated = "";
//     for await (const chunk of stream) {
//       const text = chunk.choices[0]?.delta?.content || "";
//       translated += text;
//       res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
//     }

//     research.report = translated;
//     research.language = language;
//     await research.save();

//     res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
//     res.end();
//   } catch {
//     res.write(`data: ${JSON.stringify({ error: "Translation failed" })}\n\n`);
//     res.end();
//   }
// });

// // ============================
// // EMAIL REPORT
// // ============================
// router.post("/:id/email", protect, async (req, res) => {
//   try {
//     const { to } = req.body;
//     const research = await Research.findOne({ _id: req.params.id, userId: req.user._id });
//     if (!research) return res.status(404).json({ message: "Not found" });

//     const transporter = nodemailer.createTransporter({
//       service: "gmail",
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS,
//       },
//     });

//     await transporter.sendMail({
//       from: process.env.EMAIL_USER,
//       to,
//       subject: `Research Report: ${research.query}`,
//       html: `
//         <h1>${research.query}</h1>
//         <p><strong>Reliability Score:</strong> ${research.reliabilityScore}%</p>
//         <p><strong>Sources:</strong> ${research.sources?.length || 0}</p>
//         <hr/>
//         <pre style="font-family: Arial; white-space: pre-wrap;">${research.report}</pre>
//       `,
//     });

//     res.json({ success: true, message: "Email sent!" });
//   } catch (err) {
//     res.status(500).json({ message: "Email failed: " + err.message });
//   }
// });

// // ============================
// // COLLABORATION
// // ============================
// router.post("/:id/collaborate", protect, async (req, res) => {
//   try {
//     const { email } = req.body;
//     const User = require("../models/User");
//     const collaborator = await User.findOne({ email });
//     if (!collaborator) return res.status(404).json({ message: "User not found" });

//     const research = await Research.findOne({ _id: req.params.id, userId: req.user._id });
//     if (!research) return res.status(404).json({ message: "Not found" });

//     if (!research.collaborators.includes(collaborator._id)) {
//       research.collaborators.push(collaborator._id);
//       await research.save();
//     }

//     res.json({ success: true, message: "Collaborator added!" });
//   } catch {
//     res.status(500).json({ message: "Collaboration failed" });
//   }
// });

// // Get collaborated researches
// router.get("/collaborated", protect, async (req, res) => {
//   try {
//     const researches = await Research.find({
//       collaborators: req.user._id
//     }).populate("userId", "name email").sort({ createdAt: -1 });
//     res.json({ success: true, researches });
//   } catch {
//     res.status(500).json({ message: "Fetch failed" });
//   }
// });

// // ============================
// // AUTO/SCHEDULED RESEARCH
// // ============================
// router.post("/schedule", protect, async (req, res) => {
//   try {
//     const { query, scheduledAt, urls } = req.body;
//     const research = await Research.create({
//       userId: req.user._id,
//       query,
//       isScheduled: true,
//       scheduledAt: new Date(scheduledAt),
//     });
//     res.json({ success: true, research });
//   } catch {
//     res.status(500).json({ message: "Schedule failed" });
//   }
// });

// // ============================
// // RESEARCH GRAPH
// // ============================
// router.get("/graph", protect, async (req, res) => {
//   try {
//     const researches = await Research.find({ userId: req.user._id })
//       .select("query tags sources createdAt");

//     const nodes = researches.map(r => ({
//       id: r._id,
//       label: r.query.slice(0, 30),
//       sources: r.sources?.length || 0,
//     }));

//     // ✅ Find connections — common words
//     const edges = [];
//     for (let i = 0; i < researches.length; i++) {
//       for (let j = i + 1; j < researches.length; j++) {
//         const words1 = new Set(researches[i].query.toLowerCase().split(" "));
//         const words2 = new Set(researches[j].query.toLowerCase().split(" "));
//         const common = [...words1].filter(w => words2.has(w) && w.length > 3);
//         if (common.length > 0) {
//           edges.push({
//             from: researches[i]._id,
//             to: researches[j]._id,
//             weight: common.length,
//             commonWords: common,
//           });
//         }
//       }
//     }

//     res.json({ success: true, nodes, edges });
//   } catch {
//     res.status(500).json({ message: "Graph failed" });
//   }
// });

// // ============================
// // TIMELINE
// // ============================
// router.get("/timeline", protect, async (req, res) => {
//   try {
//     const researches = await Research.find({ userId: req.user._id })
//       .sort({ createdAt: 1 })
//       .select("query createdAt reliabilityScore sources rating");

//     const grouped = researches.reduce((acc, r) => {
//       const month = new Date(r.createdAt).toLocaleString("default", { month: "long", year: "numeric" });
//       if (!acc[month]) acc[month] = [];
//       acc[month].push(r);
//       return acc;
//     }, {});

//     res.json({ success: true, timeline: grouped });
//   } catch {
//     res.status(500).json({ message: "Timeline failed" });
//   }
// });


// // ✅ Make public
// router.post("/:id/share", protect, async (req, res) => {
//   try {
//     const research = await Research.findOneAndUpdate(
//       { _id: req.params.id, userId: req.user._id },
//       { isPublic: true },
//       { new: true }
//     );
//     res.json({ success: true, shareUrl: `${process.env.CLIENT_URL}/share/${research._id}` });
//   } catch {
//     res.status(500).json({ message: "Share failed" });
//   }
// });

// // ✅ Get public research
// router.get("/public/:id", async (req, res) => {
//   try {
//     const research = await Research.findOne({ _id: req.params.id, isPublic: true })
//       .select("-userId");
//     if (!research) return res.status(404).json({ message: "Not found or not public" });
//     res.json({ success: true, research });
//   } catch {
//     res.status(500).json({ message: "Fetch failed" });
//   }
// });
// module.exports = router;




// const express = require("express");
// const router = express.Router();
// const protect = require("../middleware/auth");
// const { searchAgent, analyzerAgent, factCheckerAgent, reportWriterAgent } = require("../agents");
// const Research = require("../models/Research");
// const axios = require("axios");
// const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require("docx");
// const nodemailer = require("nodemailer");


// // ============================
// // 1. MAIN STREAM
// // ============================
// router.post("/stream", protect, async (req, res) => {
//   const { query, urls } = req.body;
//   if (!query) return res.status(400).json({ message: "Query required" });

//   res.setHeader("Content-Type", "text/event-stream");
//   res.setHeader("Cache-Control", "no-cache");
//   res.setHeader("Connection", "keep-alive");
//   res.flushHeaders();

//   const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

//   try {
//     send({ type: "start", message: "Research starting..." });

//     const { results: searchResults } = await searchAgent(query, (p) => send({ type: "agent", ...p }));

//     let extraContent = [];
//     if (urls?.length) {
//       for (const url of urls) {
//         try {
//           const { data } = await axios.get(url, {
//             timeout: 5000,
//             validateStatus: () => true,
//           });
//           const text = data.replace(/<[^>]*>?/gm, "");
//           extraContent.push({ url, content: text.slice(0, 2000) });
//         } catch {}
//       }
//     }

//     const analysis = await analyzerAgent(query, [...searchResults, ...extraContent], (p) => send({ type: "agent", ...p }));
//     const factCheck = await factCheckerAgent(query, analysis, (p) => send({ type: "agent", ...p }));
//     const report = await reportWriterAgent(query, analysis, factCheck, searchResults, (p) => send({ type: "agent", ...p }));

//     const research = await Research.create({
//       userId: req.user._id,
//       query,
//       report,
//       sources: searchResults,
//       factCheck,
//       reliabilityScore: factCheck?.reliabilityScore || 75,
//     });

//     send({ type: "done", research });
//   } catch (err) {
//     send({ type: "error", message: err.message });
//   } finally {
//     res.end();
//   }
// });


// // ============================
// // 2. GET ALL
// // ============================
// router.get("/", protect, async (req, res) => {
//   const researches = await Research.find({ userId: req.user._id })
//     .sort({ createdAt: -1 })
//     .select("-report")
//     .limit(20);

//   res.json({ success: true, researches });
// });


// // ============================
// // 3. SPECIFIC ROUTES
// // ============================

// router.get("/timeline", protect, async (req, res) => {
//   const data = await Research.find({ userId: req.user._id }).sort({ createdAt: 1 });

//   const grouped = data.reduce((acc, r) => {
//     const month = new Date(r.createdAt).toLocaleString("default", { month: "long", year: "numeric" });
//     acc[month] = acc[month] || [];
//     acc[month].push(r);
//     return acc;
//   }, {});

//   res.json({ success: true, timeline: grouped });
// });

// router.get("/graph", protect, async (req, res) => {
//   const researches = await Research.find({ userId: req.user._id });

//   const nodes = researches.map(r => ({
//     id: r._id,
//     label: r.query.slice(0, 30),
//   }));

//   const edges = [];
//   for (let i = 0; i < researches.length; i++) {
//     for (let j = i + 1; j < researches.length; j++) {
//       const words1 = new Set(researches[i].query.split(" "));
//       const words2 = new Set(researches[j].query.split(" "));
//       const common = [...words1].filter(w => words2.has(w) && w.length > 3);
//       if (common.length) {
//         edges.push({ from: researches[i]._id, to: researches[j]._id });
//       }
//     }
//   }

//   res.json({ success: true, nodes, edges });
// });

// router.get("/collaborated", protect, async (req, res) => {
//   const data = await Research.find({ collaborators: req.user._id })
//     .populate("userId", "name email");

//   res.json({ success: true, researches: data });
// });

// router.post("/schedule", protect, async (req, res) => {
//   const { query, scheduledAt } = req.body;

//   const research = await Research.create({
//     userId: req.user._id,
//     query,
//     isScheduled: true,
//     scheduledAt: new Date(scheduledAt),
//   });

//   res.json({ success: true, research });
// });

// router.get("/public/:id", async (req, res) => {
//   const research = await Research.findOne({ _id: req.params.id, isPublic: true });
//   if (!research) return res.status(404).json({ message: "Not found" });

//   res.json({ success: true, research });
// });


// // ============================
// // 4. DYNAMIC ROUTES
// // ============================

// router.get("/:id", protect, async (req, res) => {
//   const r = await Research.findOne({ _id: req.params.id, userId: req.user._id });
//   if (!r) return res.status(404).json({ message: "Not found" });

//   res.json({ success: true, research: r });
// });

// router.delete("/:id", protect, async (req, res) => {
//   await Research.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
//   res.json({ success: true });
// });

// router.post("/:id/chat", protect, async (req, res) => {
//   res.json({ message: "chat working (same as your code)" });
// });

// router.post("/:id/summary", protect, async (req, res) => {
//   res.json({ message: "summary working" });
// });

// router.post("/:id/rate", protect, async (req, res) => {
//   const { rating } = req.body;
//   const r = await Research.findByIdAndUpdate(req.params.id, { rating }, { new: true });
//   res.json({ success: true, rating: r.rating });
// });

// router.post("/:id/bookmark", protect, async (req, res) => {
//   const r = await Research.findById(req.params.id);
//   r.bookmarks.push(req.body);
//   await r.save();
//   res.json({ success: true });
// });

// router.delete("/:id/bookmark/:bookmarkId", protect, async (req, res) => {
//   const r = await Research.findById(req.params.id);
//   r.bookmarks = r.bookmarks.filter(b => b._id.toString() !== req.params.bookmarkId);
//   await r.save();
//   res.json({ success: true });
// });

// router.post("/:id/translate", protect, async (req, res) => {
//   res.json({ message: "translate working" });
// });

// router.post("/:id/email", protect, async (req, res) => {
//   const { to } = req.body;
//   const r = await Research.findById(req.params.id);

//   const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       user: process.env.EMAIL_USER,
//       pass: process.env.EMAIL_PASS,
//     },
//   });

//   await transporter.sendMail({
//     from: process.env.EMAIL_USER,
//     to,
//     subject: r.query,
//     text: r.report,
//   });

//   res.json({ success: true });
// });

// router.post("/:id/collaborate", protect, async (req, res) => {
//   res.json({ message: "collaborate working" });
// });

// router.post("/:id/share", protect, async (req, res) => {
//   const r = await Research.findByIdAndUpdate(req.params.id, { isPublic: true }, { new: true });
//   res.json({ success: true, url: `/public/${r._id}` });
// });

// router.get("/:id/export/docx", protect, async (req, res) => {
//   const r = await Research.findById(req.params.id);

//   const doc = new Document({
//     sections: [{ children: [new Paragraph(r.report)] }],
//   });

//   const buffer = await Packer.toBuffer(doc);
//   res.setHeader("Content-Disposition", "attachment; filename=report.docx");
//   res.send(buffer);
// });


// module.exports = router;









// const express = require("express");
// const router = express.Router();
// const protect = require("../middleware/auth");
// const { searchAgent, analyzerAgent, factCheckerAgent, reportWriterAgent } = require("../agents");
// const Research = require("../models/Research");
// const axios = require("axios");
// const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require("docx");
// const nodemailer = require("nodemailer");


// // ============================
// // 1. MAIN STREAM
// // ============================
// router.post("/stream", protect, async (req, res) => {
//   const { query, urls } = req.body;
//   if (!query) return res.status(400).json({ message: "Query required" });

//   res.setHeader("Content-Type", "text/event-stream");
//   res.setHeader("Cache-Control", "no-cache");
//   res.setHeader("Connection", "keep-alive");
//   res.flushHeaders();

//   const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

//   try {
//     send({ type: "start", message: "Research starting..." });

//     const { results: searchResults } = await searchAgent(query, (p) =>
//       send({ type: "agent", ...p })
//     );

//     // URL analysis
//     let extraContent = [];
//     if (urls?.length) {
//       for (const url of urls) {
//         try {
//           const { data } = await axios.get(url, {
//             timeout: 5000,
//             validateStatus: () => true,
//           });

//           const text = typeof data === "string"
//             ? data.replace(/<[^>]*>?/gm, "")
//             : JSON.stringify(data);

//           extraContent.push({
//             url,
//             content: text.slice(0, 2000),
//           });
//         } catch {}
//       }
//     }

//     const analysis = await analyzerAgent(
//       query,
//       [...searchResults, ...extraContent],
//       (p) => send({ type: "agent", ...p })
//     );

//     const factCheck = await factCheckerAgent(query, analysis, (p) =>
//       send({ type: "agent", ...p })
//     );

//     const report = await reportWriterAgent(
//       query,
//       analysis,
//       factCheck,
//       searchResults,
//       (p) => send({ type: "agent", ...p })
//     );

//     const research = await Research.create({
//       userId: req.user._id,
//       query,
//       report,
//       sources: searchResults.map(r => ({
//         title: r.title,
//         url: r.url,
//         content: r.content,
//       })),
//       factCheck,
//       reliabilityScore: factCheck?.reliabilityScore || 75,
//     });

//     send({ type: "done", research });

//   } catch (err) {
//     console.error(err);
//     send({ type: "error", message: err.message });
//   } finally {
//     res.end();
//   }
// });


// // ============================
// // 2. GET ALL
// // ============================
// router.get("/", protect, async (req, res) => {
//   try {
//     const researches = await Research.find({ userId: req.user._id })
//       .sort({ createdAt: -1 })
//       .select("-report")
//       .limit(20);

//     res.json({ success: true, researches });
//   } catch {
//     res.status(500).json({ message: "Fetch failed" });
//   }
// });


// // ============================
// // 3. SPECIFIC ROUTES (IMPORTANT)
// // ============================

// router.get("/timeline", protect, async (req, res) => {
//   try {
//     const researches = await Research.find({ userId: req.user._id })
//       .sort({ createdAt: 1 });

//     const grouped = researches.reduce((acc, r) => {
//       const month = new Date(r.createdAt).toLocaleString("default", {
//         month: "long",
//         year: "numeric",
//       });
//       acc[month] = acc[month] || [];
//       acc[month].push(r);
//       return acc;
//     }, {});

//     res.json({ success: true, timeline: grouped });
//   } catch {
//     res.status(500).json({ message: "Timeline failed" });
//   }
// });


// router.get("/graph", protect, async (req, res) => {
//   try {
//     const researches = await Research.find({ userId: req.user._id });

//     const nodes = researches.map(r => ({
//       id: r._id,
//       label: r.query.slice(0, 30),
//       sources: r.sources?.length || 0,
//     }));

//     const edges = [];
//     for (let i = 0; i < researches.length; i++) {
//       for (let j = i + 1; j < researches.length; j++) {
//         const words1 = new Set(researches[i].query.toLowerCase().split(" "));
//         const words2 = new Set(researches[j].query.toLowerCase().split(" "));
//         const common = [...words1].filter(w => words2.has(w) && w.length > 3);

//         if (common.length) {
//           edges.push({
//             from: researches[i]._id,
//             to: researches[j]._id,
//             weight: common.length,
//             commonWords: common,
//           });
//         }
//       }
//     }

//     res.json({ success: true, nodes, edges });
//   } catch {
//     res.status(500).json({ message: "Graph failed" });
//   }
// });


// router.get("/collaborated", protect, async (req, res) => {
//   try {
//     const researches = await Research.find({
//       collaborators: req.user._id,
//     }).populate("userId", "name email");

//     res.json({ success: true, researches });
//   } catch {
//     res.status(500).json({ message: "Fetch failed" });
//   }
// });


// router.post("/schedule", protect, async (req, res) => {
//   try {
//     const { query, scheduledAt } = req.body;

//     const research = await Research.create({
//       userId: req.user._id,
//       query,
//       isScheduled: true,
//       scheduledAt: new Date(scheduledAt),
//     });

//     res.json({ success: true, research });
//   } catch {
//     res.status(500).json({ message: "Schedule failed" });
//   }
// });


// router.get("/public/:id", async (req, res) => {
//   try {
//     const research = await Research.findOne({
//       _id: req.params.id,
//       isPublic: true,
//     }).select("-userId");

//     if (!research) {
//       return res.status(404).json({ message: "Not found or not public" });
//     }

//     res.json({ success: true, research });
//   } catch {
//     res.status(500).json({ message: "Fetch failed" });
//   }
// });


// // ============================
// // 4. DYNAMIC ROUTES
// // ============================

// router.get("/:id", protect, async (req, res) => {
//   try {
//     const research = await Research.findOne({
//       _id: req.params.id,
//       userId: req.user._id,
//     });

//     if (!research) return res.status(404).json({ message: "Not found" });

//     res.json({ success: true, research });
//   } catch {
//     res.status(500).json({ message: "Fetch failed" });
//   }
// });


// router.delete("/:id", protect, async (req, res) => {
//   try {
//     await Research.findOneAndDelete({
//       _id: req.params.id,
//       userId: req.user._id,
//     });

//     res.json({ success: true });
//   } catch {
//     res.status(500).json({ message: "Delete failed" });
//   }
// });


// // ============================
// // EMAIL FIXED
// // ============================
// router.post("/:id/email", protect, async (req, res) => {
//   try {
//     const { to } = req.body;

//     const research = await Research.findById(req.params.id);

//     const transporter = nodemailer.createTransport({
//       service: "gmail",
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS,
//       },
//     });

//     await transporter.sendMail({
//       from: process.env.EMAIL_USER,
//       to,
//       subject: `Research Report: ${research.query}`,
//       html: `<pre>${research.report}</pre>`,
//     });

//     res.json({ success: true, message: "Email sent!" });

//   } catch (err) {
//     res.status(500).json({ message: "Email failed: " + err.message });
//   }
// });


// // ============================
// // EXPORT DOCX
// // ============================
// router.get("/:id/export/docx", protect, async (req, res) => {
//   try {
//     const research = await Research.findById(req.params.id);

//     const lines = research.report.split("\n");
//     const children = [];

//     for (const line of lines) {
//       if (line.startsWith("# ")) {
//         children.push(new Paragraph({
//           text: line.slice(2),
//           heading: HeadingLevel.HEADING_1,
//         }));
//       } else if (line.startsWith("## ")) {
//         children.push(new Paragraph({
//           text: line.slice(3),
//           heading: HeadingLevel.HEADING_2,
//         }));
//       } else {
//         children.push(new Paragraph({
//           children: [new TextRun(line.replace(/\*\*/g, ""))],
//         }));
//       }
//     }

//     const doc = new Document({ sections: [{ children }] });
//     const buffer = await Packer.toBuffer(doc);

//     res.setHeader("Content-Disposition", "attachment; filename=report.docx");
//     res.send(buffer);

//   } catch {
//     res.status(500).json({ message: "Export failed" });
//   }
// });


// module.exports = router;









const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const { searchAgent, analyzerAgent, factCheckerAgent, reportWriterAgent } = require("../agents");
const Research = require("../models/Research");
const axios = require("axios");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require("docx");
const nodemailer = require("nodemailer");


// ============================
// MAIN RESEARCH ENDPOINT
// ============================
router.post("/stream", protect, async (req, res) => {
  const { query, urls } = req.body;

  if (!query) return res.status(400).json({ message: "Query required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    send({ type: "start", message: "Research starting..." });

    // ============================
    // AGENT 1 — Search
    // ============================
    const { results: searchResults, answer } = await searchAgent(query, (progress) => {
      send({ type: "agent", ...progress });
    });

    // ============================
    // URL/PDF Analysis (optional)
    // ============================
    let extraContent = [];
    if (urls && urls.length > 0) {
      send({ type: "agent", agent: "urlanalyzer", status: "running", message: `Analyzing ${urls.length} URLs...` });
      for (const url of urls) {
        try {
          const { data } = await axios.get(url, { timeout: 5000 });
          extraContent.push({ url, content: data.substring(0, 2000) });
        } catch {}
      }
      send({ type: "agent", agent: "urlanalyzer", status: "done", message: "URLs analyzed" });
    }

    // ============================
    // AGENT 2 — Analyze
    // ============================
    const analysis = await analyzerAgent(
      query,
      [...searchResults, ...extraContent],
      (progress) => send({ type: "agent", ...progress })
    );

    // ============================
    // AGENT 3 — Fact Check
    // ============================
    const factCheck = await factCheckerAgent(query, analysis, (progress) => {
      send({ type: "agent", ...progress });
    });

    // ============================
    // AGENT 4 — Write Report
    // ============================
    const report = await reportWriterAgent(
      query, analysis, factCheck, searchResults,
      (progress) => send({ type: "agent", ...progress })
    );

    // ============================
    // Save to DB
    // ============================
    const research = await Research.create({
      userId: req.user._id,
      query,
      report,
      sources: searchResults.map(r => ({ title: r.title, url: r.url, content: r.content })),
      factCheck,
      reliabilityScore: factCheck.reliabilityScore || 75,
    });

    send({ type: "done", research });

  } catch (err) {
    console.error("Research error:", err);
    send({ type: "error", message: err.message });
  } finally {
    res.end();
  }
});

// ============================
// GET ALL RESEARCH
// ============================
router.get("/", protect, async (req, res) => {
  try {
    const researches = await Research.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select("-report")
      .limit(20);
    res.json({ success: true, researches });
  } catch {
    res.status(500).json({ message: "Fetch failed" });
  }
});




// ============================
// TIMELINE
// ============================
router.get("/timeline", protect, async (req, res) => {
  try {
    const researches = await Research.find({ userId: req.user._id })
      .sort({ createdAt: 1 })
      .select("query createdAt reliabilityScore sources rating");

    const grouped = researches.reduce((acc, r) => {
      const month = new Date(r.createdAt).toLocaleString("default", { month: "long", year: "numeric" });
      if (!acc[month]) acc[month] = [];
      acc[month].push(r);
      return acc;
    }, {});

    res.json({ success: true, timeline: grouped });
  } catch {
    res.status(500).json({ message: "Timeline failed" });
  }
});




// ============================
// RESEARCH GRAPH
// ============================
router.get("/graph", protect, async (req, res) => {
  try {
    const researches = await Research.find({ userId: req.user._id })
      .select("query tags sources createdAt");

    const nodes = researches.map(r => ({
      id: r._id,
      label: r.query.slice(0, 30),
      sources: r.sources?.length || 0,
    }));

    // ✅ Find connections — common words
    const edges = [];
    for (let i = 0; i < researches.length; i++) {
      for (let j = i + 1; j < researches.length; j++) {
        const words1 = new Set(researches[i].query.toLowerCase().split(" "));
        const words2 = new Set(researches[j].query.toLowerCase().split(" "));
        const common = [...words1].filter(w => words2.has(w) && w.length > 3);
        if (common.length > 0) {
          edges.push({
            from: researches[i]._id,
            to: researches[j]._id,
            weight: common.length,
            commonWords: common,
          });
        }
      }
    }

    res.json({ success: true, nodes, edges });
  } catch {
    res.status(500).json({ message: "Graph failed" });
  }
});




// ============================
// COLLABORATION
// ============================

// Get collaborated researches
router.get("/collaborated", protect, async (req, res) => {
  try {
    const researches = await Research.find({
      collaborators: req.user._id
    }).populate("userId", "name email").sort({ createdAt: -1 });
    res.json({ success: true, researches });
  } catch {
    res.status(500).json({ message: "Fetch failed" });
  }
});



router.post("/:id/collaborate", protect, async (req, res) => {
  console.log("BODY:", req.body);
  try {
    const { email } = req.body;
    const User = require("../models/User");
    const collaborator = await User.findOne({ email });
    console.log("User found:", collaborator);
    if (!collaborator) return res.status(404).json({ message: "User not found" });

    const research = await Research.findOne({ _id: req.params.id, userId: req.user._id });
    if (!research) return res.status(404).json({ message: "Not found" });

    if (!research.collaborators.includes(collaborator._id)) {
      research.collaborators.push(collaborator._id);
      await research.save();
    }

    res.json({ success: true, message: "Collaborator added!" });
  } catch {
    res.status(500).json({ message: "Collaboration failed" });
  }
});

// ============================
// AUTO/SCHEDULED RESEARCH
// ============================
router.post("/schedule", protect, async (req, res) => {
  try {
    const { query, scheduledAt, urls } = req.body;
    const research = await Research.create({
      userId: req.user._id,
      query,
      isScheduled: true,
      scheduledAt: new Date(scheduledAt),
    });
    res.json({ success: true, research });
  } catch {
    res.status(500).json({ message: "Schedule failed" });
  }
});


// ✅ Get public research
router.get("/public/:id", async (req, res) => {
  try {
    const research = await Research.findOne({ _id: req.params.id, isPublic: true })
      .select("-userId");
    if (!research) return res.status(404).json({ message: "Not found or not public" });
    res.json({ success: true, research });
  } catch {
    res.status(500).json({ message: "Fetch failed" });
  }
});

// ============================
// GET SINGLE RESEARCH
// ============================
router.get("/:id", protect, async (req, res) => {
  try {
    const research = await Research.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!research) return res.status(404).json({ message: "Not found" });
    res.json({ success: true, research });
  } catch {
    res.status(500).json({ message: "Fetch failed" });
  }
});

// ============================
// DELETE RESEARCH
// ============================
router.delete("/:id", protect, async (req, res) => {
  try {
    await Research.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Delete failed" });
  }
});

// ============================
// CHAT WITH RESEARCH
// ============================
router.post("/:id/chat", protect, async (req, res) => {
  const { message, history } = req.body;

  try {
    const research = await Research.findOne({ _id: req.params.id, userId: req.user._id });
    if (!research) return res.status(404).json({ message: "Not found" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const Groq = require("groq-sdk");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const stream = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `You are a research assistant. Answer questions based on this research report:\n\n${research.report.substring(0, 3000)}`
        },
        ...(history || []),
        { role: "user", content: message }
      ],
      stream: true,
      max_tokens: 500,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      if (text) res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ✅ DOCX Export
router.get("/:id/export/docx", protect, async (req, res) => {
  try {
    const research = await Research.findOne({ _id: req.params.id, userId: req.user._id });
    if (!research) return res.status(404).json({ message: "Not found" });

    const lines = research.report.split("\n");
    const children = [];

    for (const line of lines) {
      if (line.startsWith("# ")) {
        children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
      } else if (line.startsWith("## ")) {
        children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
      } else if (line.startsWith("### ")) {
        children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
      } else if (line.trim()) {
        children.push(new Paragraph({ children: [new TextRun({ text: line.replace(/\*\*/g, "").replace(/\*/g, "") })] }));
      } else {
        children.push(new Paragraph({ text: "" }));
      }
    }

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="research.docx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: "Export failed" });
  }
});


// ============================
// AI SUMMARY
// ============================
router.post("/:id/summary", protect, async (req, res) => {
  try {
    const research = await Research.findOne({ _id: req.params.id, userId: req.user._id });
    if (!research) return res.status(404).json({ message: "Not found" });

    const Groq = require("groq-sdk");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: "Create a concise 1-page executive summary of the research report. Include key findings, conclusions, and recommendations."
        },
        {
          role: "user",
          content: `Research: "${research.query}"\n\nReport:\n${research.report.substring(0, 4000)}\n\nCreate a 1-page summary in markdown format.`
        }
      ],
      max_tokens: 800,
    });

    const summary = completion.choices[0]?.message?.content || "";
    research.summary = summary;
    await research.save();

    res.json({ success: true, summary });
  } catch {
    res.status(500).json({ message: "Summary failed" });
  }
});

// ============================
// RATING
// ============================
router.post("/:id/rate", protect, async (req, res) => {
  try {
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating 1-5 hona chahiye" });
    }
    const research = await Research.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { rating },
      { new: true }
    );
    res.json({ success: true, rating: research.rating });
  } catch {
    res.status(500).json({ message: "Rating failed" });
  }
});

// ============================
// BOOKMARKS
// ============================
router.post("/:id/bookmark", protect, async (req, res) => {
  try {
    const { text, note } = req.body;
    const research = await Research.findOne({ _id: req.params.id, userId: req.user._id });
    if (!research) return res.status(404).json({ message: "Not found" });

    research.bookmarks.push({ text, note });
    await research.save();

    res.json({ success: true, bookmarks: research.bookmarks });
  } catch {
    res.status(500).json({ message: "Bookmark failed" });
  }
});

router.delete("/:id/bookmark/:bookmarkId", protect, async (req, res) => {
  try {
    const research = await Research.findOne({ _id: req.params.id, userId: req.user._id });
    research.bookmarks = research.bookmarks.filter(
      b => b._id.toString() !== req.params.bookmarkId
    );
    await research.save();
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Delete failed" });
  }
});

// ============================
// MULTI-LANGUAGE
// ============================
router.post("/:id/translate", protect, async (req, res) => {
  try {
    const { language } = req.body;
    const research = await Research.findOne({ _id: req.params.id, userId: req.user._id });
    if (!research) return res.status(404).json({ message: "Not found" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const Groq = require("groq-sdk");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const langMap = {
      hindi: "Hindi",
      english: "English",
      spanish: "Spanish",
      french: "French",
    };

    const stream = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `Translate the following research report to ${langMap[language] || language}. Keep the markdown formatting.`
        },
        {
          role: "user",
          content: research.report.substring(0, 4000)
        }
      ],
      stream: true,
      max_tokens: 3000,
    });

    let translated = "";
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      translated += text;
      res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
    }

    research.report = translated;
    research.language = language;
    await research.save();

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch {
    res.write(`data: ${JSON.stringify({ error: "Translation failed" })}\n\n`);
    res.end();
  }
});




// ============================
// EMAIL REPORT
// ============================
router.post("/:id/email", protect, async (req, res) => {
  try {
    const { to } = req.body;
    const research = await Research.findOne({ _id: req.params.id, userId: req.user._id });
    if (!research) return res.status(404).json({ message: "Not found" });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: `Research Report: ${research.query}`,
      html: `
        <h1>${research.query}</h1>
        <p><strong>Reliability Score:</strong> ${research.reliabilityScore}%</p>
        <p><strong>Sources:</strong> ${research.sources?.length || 0}</p>
        <hr/>
        <pre style="font-family: Arial; white-space: pre-wrap;">${research.report}</pre>
      `,
    });

    res.json({ success: true, message: "Email sent!" });
  } catch (err) {
    res.status(500).json({ message: "Email failed: " + err.message });
  }
});



// ✅ Make public
router.post("/:id/share", protect, async (req, res) => {
  try {
    const research = await Research.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isPublic: true },
      { new: true }
    );
    res.json({ success: true, shareUrl: `${process.env.CLIENT_URL}/share/${research._id}` });
  } catch {
    res.status(500).json({ message: "Share failed" });
  }
});

module.exports = router;