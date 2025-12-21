'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Projects', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      coverImage: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'MinIO storage path for cover image',
      },
      repoLink: {
        type: Sequelize.STRING,
        allowNull: true,
        validate: {
          isUrl: true,
        },
      },
      featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      createdBy: {
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
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Add indexes for main table
    await queryInterface.addIndex('Projects', ['createdBy'], {
      name: 'projects_created_by_idx',
    });

    await queryInterface.addIndex('Projects', ['featured'], {
      name: 'projects_featured_idx',
    });

    await queryInterface.addIndex('Projects', ['title'], {
      name: 'projects_title_idx',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('Projects');
  },
};
