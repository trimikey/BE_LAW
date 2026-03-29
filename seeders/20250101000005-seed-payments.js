'use strict';

const { Payment, User, Case, Consultation } = require('../models');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Get user IDs by role name
    const { Role } = require('../models');
    const clientRole = await Role.findOne({ where: { name: 'client' } });
    
    const clients = await User.findAll({ 
      where: { role_id: clientRole.id },
      limit: 3 
    });
    const cases = await Case.findAll({ limit: 3 });
    const consultations = await Consultation.findAll({ limit: 3 });

    if (clients.length === 0) {
      console.log('⚠️ Không có client để tạo payments. Vui lòng chạy seed users trước.');
      return;
    }

    const payments = [
      {
        user_id: clients[0].id,
        case_id: cases[0]?.id || null,
        consultation_id: null,
        amount: 2000000,
        payment_type: 'case_fee',
        payment_method: 'bank_transfer',
        status: 'completed',
        transaction_id: 'TXN-' + Date.now() + '-001',
        payment_date: new Date('2025-01-10'),
        notes: 'Thanh toán phí tư vấn hợp đồng lao động',
        created_at: new Date('2025-01-10'),
        updated_at: new Date('2025-01-10')
      },
      {
        user_id: clients[0].id,
        case_id: null,
        consultation_id: consultations[0]?.id || null,
        amount: 500000,
        payment_type: 'consultation',
        payment_method: 'e_wallet',
        status: 'completed',
        transaction_id: 'TXN-' + Date.now() + '-002',
        payment_date: new Date(),
        notes: 'Thanh toán phí tư vấn video call',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        user_id: clients[1]?.id || clients[0].id,
        case_id: cases[1]?.id || null,
        consultation_id: null,
        amount: 5000000,
        payment_type: 'deposit',
        payment_method: 'bank_transfer',
        status: 'completed',
        transaction_id: 'TXN-' + Date.now() + '-003',
        payment_date: new Date('2025-01-12'),
        notes: 'Đặt cọc cho dịch vụ soạn thảo hợp đồng',
        created_at: new Date('2025-01-12'),
        updated_at: new Date('2025-01-12')
      },
      {
        user_id: clients[0].id,
        case_id: null,
        consultation_id: consultations[1]?.id || null,
        amount: 300000,
        payment_type: 'consultation',
        payment_method: 'credit_card',
        status: 'completed',
        transaction_id: 'TXN-' + Date.now() + '-004',
        payment_date: new Date(),
        notes: 'Thanh toán phí tư vấn điện thoại',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        user_id: clients[2]?.id || clients[0].id,
        case_id: cases[2]?.id || null,
        consultation_id: null,
        amount: 10000000,
        payment_type: 'case_fee',
        payment_method: 'bank_transfer',
        status: 'pending',
        transaction_id: null,
        payment_date: null,
        notes: 'Chờ thanh toán cho dịch vụ tranh chấp hợp đồng',
        created_at: new Date('2025-01-13'),
        updated_at: new Date('2025-01-13')
      },
      {
        user_id: clients[0].id,
        case_id: null,
        consultation_id: consultations[2]?.id || null,
        amount: 500000,
        payment_type: 'consultation',
        payment_method: 'e_wallet',
        status: 'completed',
        transaction_id: 'TXN-' + Date.now() + '-005',
        payment_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        notes: 'Thanh toán phí tư vấn đã hoàn thành',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      }
    ];

    await Payment.bulkCreate(payments);
    console.log('✅ Đã tạo payments mẫu');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('payments', null, {});
  }
};
