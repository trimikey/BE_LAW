'use strict';

const { Consultation, User, Case } = require('../models');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Get user IDs by role name
    const { Role } = require('../models');
    const clientRole = await Role.findOne({ where: { name: 'client' } });
    const lawyerRole = await Role.findOne({ where: { name: 'lawyer' } });
    
    const clients = await User.findAll({ 
      where: { role_id: clientRole.id },
      limit: 3 
    });
    const lawyers = await User.findAll({ 
      where: { role_id: lawyerRole.id },
      limit: 2 
    });
    const cases = await Case.findAll({ limit: 3 });

    if (clients.length === 0 || lawyers.length === 0) {
      console.log('⚠️ Không có client hoặc lawyer để tạo consultations. Vui lòng chạy seed users trước.');
      return;
    }

    const now = new Date();
    const consultations = [
      {
        client_id: clients[0].id,
        lawyer_id: lawyers[0].id,
        case_id: cases[0]?.id || null,
        scheduled_at: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 ngày sau
        duration: 60,
        consultation_type: 'video',
        status: 'pending',
        fee: 500000,
        meeting_link: 'https://meet.google.com/abc-defg-hij',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        client_id: clients[0].id,
        lawyer_id: lawyers[0].id,
        case_id: cases[1]?.id || null,
        scheduled_at: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 ngày sau
        duration: 30,
        consultation_type: 'phone',
        status: 'confirmed',
        fee: 300000,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        client_id: clients[1]?.id || clients[0].id,
        lawyer_id: lawyers[1]?.id || lawyers[0].id,
        case_id: cases[2]?.id || null,
        scheduled_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 ngày trước
        duration: 60,
        consultation_type: 'video',
        status: 'completed',
        fee: 500000,
        meeting_link: 'https://meet.google.com/xyz-uvwx-rst',
        created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        updated_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        client_id: clients[2]?.id || clients[0].id,
        lawyer_id: lawyers[0].id,
        case_id: null,
        scheduled_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 ngày sau
        duration: 90,
        consultation_type: 'in_person',
        status: 'pending',
        fee: 800000,
        notes: 'Gặp trực tiếp tại văn phòng luật sư',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        client_id: clients[0].id,
        lawyer_id: lawyers[1]?.id || lawyers[0].id,
        case_id: null,
        scheduled_at: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), // 1 ngày sau
        duration: 45,
        consultation_type: 'video',
        status: 'pending',
        fee: 400000,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await Consultation.bulkCreate(consultations);
    console.log('✅ Đã tạo consultations mẫu');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('consultations', null, {});
  }
};
