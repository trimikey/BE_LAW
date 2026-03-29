'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('documents', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      case_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'cases',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      consultation_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'consultations',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      uploaded_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      file_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      file_path: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      file_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      file_type: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      file_size: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      category: {
        type: Sequelize.ENUM('original', 'copy', 'power_of_attorney', 'evidence', 'contract', 'other'),
        allowNull: false,
        defaultValue: 'other'
      },
      document_type: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      is_original: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      version: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      parent_document_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'documents',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      is_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      verified_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      verified_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('documents', ['case_id'], { name: 'idx_documents_case_id' });
    await queryInterface.addIndex('documents', ['consultation_id'], { name: 'idx_documents_consultation_id' });
    await queryInterface.addIndex('documents', ['uploaded_by'], { name: 'idx_documents_uploaded_by' });
    await queryInterface.addIndex('documents', ['category'], { name: 'idx_documents_category' });
    await queryInterface.addIndex('documents', ['is_original'], { name: 'idx_documents_is_original' });
    await queryInterface.addIndex('documents', ['is_verified'], { name: 'idx_documents_is_verified' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('documents');
  }
};
