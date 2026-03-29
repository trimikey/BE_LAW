require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    logging: console.log
});

const run = async () => {
    try {
        const queryInterface = sequelize.getQueryInterface();

        console.log('Creating lawyer_reviews table...');
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
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE'
            },
            client_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
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

        console.log('Adding indexes to lawyer_reviews...');
        await queryInterface.addIndex('lawyer_reviews', ['lawyer_id'], { name: 'idx_lawyer_reviews_lawyer_id' });
        await queryInterface.addIndex('lawyer_reviews', ['client_id'], { name: 'idx_lawyer_reviews_client_id' });

        console.log('✅ lawyer_reviews table created successfully!');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
};

run();
