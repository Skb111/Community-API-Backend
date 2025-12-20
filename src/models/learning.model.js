'use strict';
const { Model } = require('sequelize');
const { uuidv7 } = require('uuidv7');

module.exports = (sequelize, DataTypes) => {
  class Learning extends Model {
    static associate(models) {
      // Learning creator
      Learning.belongsTo(models.User, {
        foreignKey: 'createdBy',
        as: 'creator',
        onDelete: 'SET NULL',
      });

      // Learning learners (many-to-many)
      Learning.belongsToMany(models.User, {
        through: 'LearningLearners',
        foreignKey: 'learningId',
        otherKey: 'userId',
        as: 'learners',
      });

      // Learning techs (many-to-many)
      Learning.belongsToMany(models.Tech, {
        through: 'LearningTechs',
        foreignKey: 'learningId',
        otherKey: 'techId',
        as: 'techs',
      });
    }
  }

  Learning.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: () => uuidv7(),
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: {
            msg: 'Learning title is required',
          },
          notEmpty: {
            msg: 'Learning title cannot be empty',
          },
          len: {
            args: [1, 255],
            msg: 'Learning title must be between 1 and 255 characters',
          },
        },
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          len: {
            args: [0, 1000],
            msg: 'Description cannot exceed 1000 characters',
          },
        },
      },
      period: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          len: {
            args: [0, 50],
            msg: 'Period cannot exceed 50 characters',
          },
        },
      },
      link: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isUrl: {
            args: true,
            msg: 'Link must be a valid URL',
          },
        },
      },
      coverImage: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isUrl: {
            args: true,
            msg: 'Cover image must be a valid URL or storage path',
          },
        },
      },
      featured: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      createdBy: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
    },
    {
      sequelize,
      modelName: 'Learning',
      tableName: 'Learnings',
      timestamps: true,
      paranoid: true,
      indexes: [
        {
          name: 'learnings_title_idx',
          fields: ['title'],
        },
        {
          name: 'learnings_created_by_idx',
          fields: ['createdBy'],
        },
        {
          name: 'learnings_featured_idx',
          fields: ['featured'],
        },
      ],
    }
  );

  return Learning;
};
