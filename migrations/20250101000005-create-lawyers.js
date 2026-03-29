'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lawyers', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      bar_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Số thẻ luật sư'
      },
      certificate_number: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Số chứng chỉ hành nghề'
      },
      license_issued_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Ngày cấp chứng chỉ'
      },
      license_expiry_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Ngày hết hạn chứng chỉ'
      },
      law_firm: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Tên văn phòng luật sư'
      },
      specialties: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Chuyên môn (JSON array)'
      },
      years_of_experience: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Số năm kinh nghiệm'
      },
      bio: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Tiểu sử'
      },
      verification_status: {
        type: Sequelize.ENUM('pending', 'verified', 'rejected'),
        defaultValue: 'pending',
        comment: 'Trạng thái xác thực: pending, verified, rejected'
      },
      verification_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Ghi chú xác thực từ admin'
      },
      verified_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Ngày xác thực'
      },
      verified_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Admin ID xác thực'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    }, {
      engine: 'InnoDB',
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    });

    // Tạo indexes
    await queryInterface.addIndex('lawyers', ['user_id'], { name: 'idx_user_id' });
    await queryInterface.addIndex('lawyers', ['bar_number'], { name: 'idx_bar_number' });
    await queryInterface.addIndex('lawyers', ['verification_status'], { name: 'idx_verification_status' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('lawyers');
  }
};
