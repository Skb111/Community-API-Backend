'use strict';
const { Model } = require('sequelize');
const { uuidv7 } = require('uuidv7');

module.exports = (sequelize, DataTypes) => {
  class Blog extends Model {
    static associate(models) {
      // Blog belongs to User (author)
      Blog.belongsTo(models.User, {
        foreignKey: 'createdBy',
        as: 'author',
        onDelete: 'CASCADE',
      });
    }
  }

  Blog.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv7(),
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: 'Title cannot be empty',
          },
          len: {
            args: [1, 255],
            msg: 'Title must be between 1 and 255 characters',
          },
        },
      },
      createdBy: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: 'Body cannot be empty',
          },
        },
      },
      coverImage: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      topic: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      featured: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'Blog',
      tableName: 'Blogs',
      timestamps: true,
    }
  );

  return Blog;
};

