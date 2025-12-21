'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ProjectTechs', {
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
      techId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Techs',
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
    await queryInterface.addIndex('ProjectTechs', ['projectId', 'techId'], {
      name: 'project_techs_unique_idx',
      unique: true,
    });

    await queryInterface.addIndex('ProjectTechs', ['projectId'], {
      name: 'project_techs_project_id_idx',
    });

    await queryInterface.addIndex('ProjectTechs', ['techId'], {
      name: 'project_techs_tech_id_idx',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('ProjectTechs');
  },
};
