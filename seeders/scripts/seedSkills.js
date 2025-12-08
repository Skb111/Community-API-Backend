'use strict';

const fs = require('fs').promises;
const path = require('path');
const { Skill, sequelize } = require('../../src/models');

/**
 * Bulk seed skills from JSON file (faster, but less granular error handling)
 */
async function seedSkills() {
  const transaction = await sequelize.transaction();

  try {
    console.log('Starting bulk skills seeding process...');

    // Read the JSON file
    const filePath = path.join(__dirname, '../data/skills.json');
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const skillsData = JSON.parse(fileContent);

    console.log(`Found ${skillsData.length} skills to seed`);

    // Prepare data for bulk insert
    const preparedData = skillsData.map((skill) => ({
      name: skill.name,
      description: skill.description || null,
      createdBy: null,
    }));

    // Use bulkCreate with ignoreDuplicates option
    const result = await Skill.bulkCreate(preparedData, {
      ignoreDuplicates: true,
      transaction,
    });

    await transaction.commit();

    console.log('\n=== Bulk Seeding Summary ===');
    console.log(`Total skills in file: ${skillsData.length}`);
    console.log(`Successfully inserted: ${result.length}`);
    console.log(`Skipped (duplicates): ${skillsData.length - result.length}`);
    console.log('============================\n');

    return result;
  } catch (error) {
    await transaction.rollback();
    console.error('Fatal error during bulk seeding:', error);
    throw error;
  }
}

// Run the seeder if called directly
if (require.main === module) {
  seedSkills()
    .then(() => {
      console.log('Bulk seeding completed successfully');
      // eslint-disable-next-line no-process-exit
      process.exit(0);
    })
    .catch((error) => {
      console.error('Bulk seeding failed:', error);
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    });
}
