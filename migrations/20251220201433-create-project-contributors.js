'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ProjectContributors', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
      },
      projectId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Projects',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes
    await queryInterface.addIndex('ProjectContributors', ['projectId', 'userId'], {
      name: 'project_contributors_unique_idx',
      unique: true,
    });

    await queryInterface.addIndex('ProjectContributors', ['projectId'], {
      name: 'project_contributors_project_id_idx',
    });

    await queryInterface.addIndex('ProjectContributors', ['userId'], {
      name: 'project_contributors_user_id_idx',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('ProjectContributors');
  },
};
