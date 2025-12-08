'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Blogs', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
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
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      coverImage: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      topic: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      featured: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // Add index on createdBy for better query performance
    await queryInterface.addIndex('Blogs', ['createdBy'], {
      name: 'blogs_createdBy_idx',
    });

    // Add index on featured for filtering featured blogs
    await queryInterface.addIndex('Blogs', ['featured'], {
      name: 'blogs_featured_idx',
    });

    // Add index on topic for filtering by topic
    await queryInterface.addIndex('Blogs', ['topic'], {
      name: 'blogs_topic_idx',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.removeIndex('Blogs', 'blogs_topic_idx');
    await queryInterface.removeIndex('Blogs', 'blogs_featured_idx');
    await queryInterface.removeIndex('Blogs', 'blogs_createdBy_idx');
    await queryInterface.dropTable('Blogs');
  },
};

