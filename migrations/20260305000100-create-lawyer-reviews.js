'use strict';

const hasIndex = (indexes, name) => indexes.some((idx) => idx?.name === name);

module.exports = {
  async up(queryInterface, Sequelize) {
    let tableExists = true;
    try {
      await queryInterface.describeTable('lawyer_reviews');
    } catch {
      tableExists = false;
    }

    if (!tableExists) {
      await queryInterface.createTable('lawyer_reviews', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        lawyer_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        client_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        rating: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        comment: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        is_hidden: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
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
    }

    const indexes = await queryInterface.showIndex('lawyer_reviews').catch(() => []);

    if (!hasIndex(indexes, 'idx_lawyer_reviews_lawyer_id')) {
      await queryInterface.addIndex('lawyer_reviews', ['lawyer_id'], { name: 'idx_lawyer_reviews_lawyer_id' });
    }
    if (!hasIndex(indexes, 'idx_lawyer_reviews_client_id')) {
      await queryInterface.addIndex('lawyer_reviews', ['client_id'], { name: 'idx_lawyer_reviews_client_id' });
    }
    if (!hasIndex(indexes, 'idx_lawyer_reviews_rating')) {
      await queryInterface.addIndex('lawyer_reviews', ['rating'], { name: 'idx_lawyer_reviews_rating' });
    }
    if (!hasIndex(indexes, 'uniq_lawyer_reviews_pair')) {
      await queryInterface.addIndex('lawyer_reviews', ['lawyer_id', 'client_id'], {
        name: 'uniq_lawyer_reviews_pair',
        unique: true
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lawyer_reviews');
  }
};
