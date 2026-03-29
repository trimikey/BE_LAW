const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { Op } = require('sequelize');
const { sequelize, LawyerAvailability } = require('../models');

const toBlocks = (start, end) => {
    const blocks = [];
    let cursor = new Date(start);

    while (cursor < end) {
        const next = new Date(cursor.getTime() + 60 * 60000);
        if (next > end) {
            return { ok: false, blocks: [], remainderMinutes: Math.round((end.getTime() - cursor.getTime()) / 60000) };
        }
        blocks.push({ start: new Date(cursor), end: next });
        cursor = next;
    }

    return { ok: true, blocks, remainderMinutes: 0 };
};

const main = async () => {
    let migrated = 0;
    let skipped = 0;

    try {
        await sequelize.authenticate();

        const slots = await LawyerAvailability.findAll({
            where: {
                status: 'available',
                end_time: { [Op.gt]: sequelize.col('start_time') }
            },
            order: [['id', 'ASC']]
        });

        console.log(`Found ${slots.length} available slots to inspect.`);

        for (const slot of slots) {
            const start = new Date(slot.start_time);
            const end = new Date(slot.end_time);
            const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

            if (durationMinutes === 60) {
                continue;
            }

            const splitResult = toBlocks(start, end);
            if (!splitResult.ok) {
                skipped += 1;
                console.log(`Skip slot #${slot.id}: duration ${durationMinutes} minutes is not divisible by 60 (remainder ${splitResult.remainderMinutes}m).`);
                continue;
            }

            await sequelize.transaction(async (transaction) => {
                await LawyerAvailability.bulkCreate(
                    splitResult.blocks.map((block) => ({
                        lawyer_id: slot.lawyer_id,
                        start_time: block.start,
                        end_time: block.end,
                        status: slot.status,
                        consultation_type: slot.consultation_type,
                        notes: slot.notes,
                        booked_by_client_id: slot.booked_by_client_id,
                        booked_consultation_id: slot.booked_consultation_id
                    })),
                    { transaction }
                );

                await slot.destroy({ transaction });
            });

            migrated += 1;
            console.log(`Migrated slot #${slot.id} into ${splitResult.blocks.length} hourly blocks.`);
        }

        console.log(`Done. Migrated: ${migrated}. Skipped: ${skipped}.`);
        process.exit(0);
    } catch (error) {
        console.error('Failed to migrate availability slots:', error);
        process.exit(1);
    }
};

main();
