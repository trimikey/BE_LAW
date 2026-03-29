const axios = require('axios');

/**
 * AI Legal Chatbot Controller
 * For production, use Gemini or OpenAI API key in .env
 */
const chat = async (req, res) => {
    try {
        const { message, history } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        // --- OPTIONAL: Real Gemini API Implementation ---
        /*
        const response = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + process.env.GEMINI_API_KEY, {
            contents: [
                ...history,
                { role: "user", parts: [{ text: message }] }
            ],
            system_instruction: {
                parts: [{ text: "Bạn là một luật sư trợ lý ảo tên là Antigravity Law AI. Bạn trả lời các câu hỏi về pháp luật Việt Nam một cách chuyên nghiệp, chính xác và dễ hiểu. Luôn nhắc nhở người dùng rằng tư vấn của bạn chỉ mang tính tham khảo và họ nên tham vấn luật sư chuyên môn trên nền tảng của chúng tôi." }]
            }
        });
        const aiText = response.data.candidates[0].content.parts[0].text;
        */

        // --- MOCKED RESPONSE (If no API Key) ---
        let aiText = "Chào bạn, tôi là Antigravity Law AI. ";
        if (message.toLowerCase().includes("vụ việc") || message.toLowerCase().includes("kiện")) {
            aiText += "Với các vấn đề tranh chấp, bạn nên chuẩn bị đầy đủ hồ sơ và liên hệ với luật sư chuyên môn về Dân sự hoặc Hình sự trên ứng dụng. Tôi thấy bạn đang hỏi về " + message + ". Đây là một vấn đề cần xem xét kỹ các quy định của Bộ luật Dân sự 2015.";
        } else if (message.toLowerCase().includes("thuế")) {
            aiText += "Về lĩnh vực Thuế, các quy định thường thay đổi nhanh. Bạn nên tham khảo luật sư chuyên về Tài chính - Thuế để được tư vấn chính xác nhất cho trường hợp của mình.";
        } else {
            aiText += "Tôi có thể giúp bạn hiểu rõ hơn về các quy định pháp luật. Hãy đặt câu hỏi cụ thể hơn nhé! Lưu ý: Thông tin tôi cung cấp chỉ mang tính tham khảo.";
        }

        res.json({
            success: true,
            data: {
                reply: aiText
            }
        });
    } catch (error) {
        console.error('AI Chat Error:', error);
        res.status(500).json({ success: false, message: 'AI processing failed' });
    }
};

module.exports = {
    chat
};
