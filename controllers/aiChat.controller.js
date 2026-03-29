import { chatWithAI } from "../services/aiChat.service.js";

export const chatAI = async (req, res) => {
  try {
    const { message, caseId } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }

    // (Optional) Lấy context từ case
    let context = "";
    if (caseId) {
      // load case info từ DB
      context = `Thông tin vụ việc: ...`;
    }

    const reply = await chatWithAI({ message, context });

    res.json({
      success: true,
      reply
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "AI error" });
  }
};
