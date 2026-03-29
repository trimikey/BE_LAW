const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Lawyer, User } = require('../models');

const seedData = async () => {
    try {
        console.log('Seeding fake data for search...');
        const lawyers = await Lawyer.findAll();
        console.log(`Found ${lawyers.length} lawyers.`);

        const cities = ["Hà Nội", "Hồ Chí Minh", "Đà Nẵng", "Bình Dương"];
        const schools = ["Đại học Luật Hà Nội", "Đại học Luật TP.HCM", "Học viện Tư pháp"];
        const specialties = ["Dân sự", "Hình sự", "Đất đai", "Hôn nhân gia đình", "Doanh nghiệp"];

        for (const lawyer of lawyers) {
            const randomCity = cities[Math.floor(Math.random() * cities.length)];
            const randomSchool = schools[Math.floor(Math.random() * schools.length)];
            const randomSpecialty = specialties.sort(() => .5 - Math.random()).slice(0, 2).join(", ");
            const randomFee = (Math.floor(Math.random() * 20) + 1) * 100000; // 100k - 2000k

            await lawyer.update({
                city: lawyer.city || randomCity,
                education: lawyer.education || randomSchool,
                consultation_fee: lawyer.consultation_fee || randomFee,
                rating: 4.5 + Math.random() * 0.5, // 4.5 - 5.0
                review_count: Math.floor(Math.random() * 50),
                verification_status: 'verified', // Force verify for testing
                specialties: lawyer.specialties || randomSpecialty
            });
        }

        console.log('Data seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
};

seedData();
