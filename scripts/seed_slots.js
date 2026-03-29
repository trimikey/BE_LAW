const { LawyerAvailability } = require('../models');

async function seed() {
    const lawyerId = 13; // Sửa ID luật sư ở đây nếu cần
    const startDate = new Date();

    for (let i = 0; i < 10; i++) {
        const startTime = new Date(startDate.getTime() + (i + 1) * 60 * 60 * 1000); // Mỗi giờ một slot
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Thời gian 1 tiếng

        await LawyerAvailability.create({
            lawyer_id: lawyerId,
            start_time: startTime,
            end_time: endTime,
            status: 'available'
        });
        console.log(`Created slot: ${startTime.toLocaleString()}`);
    }
    process.exit(0);
}

seed();
