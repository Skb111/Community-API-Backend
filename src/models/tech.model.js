'use strict';
const { Model } = require('sequelize');
const { uuidv7 } = require('uuidv7');

module.exports = (sequelize, DataTypes) => {
  class Tech extends Model {
    static associate(models) {
      // Tech creator (belongs to one user who created it)
      Tech.belongsTo(models.User, {
        foreignKey: 'createdBy',
        as: 'creator',
        onDelete: 'SET NULL',
      });

      // Many-to-many: Tech used in Projects
      Tech.belongsToMany(models.Project, {
        through: 'ProjectTechs',
        foreignKey: 'techId',
        otherKey: 'projectId',
        as: 'projects',
      });

      // Many-to-many: Tech used in Learning resources
      Tech.belongsToMany(models.Learning, {
        through: 'LearningTechs',
        foreignKey: 'techId',
        otherKey: 'learningId',
        as: 'learnings',
      });
    }
  }

  Tech.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: () => uuidv7(),
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: {
          name: 'techs_name_unique',
          msg: 'Tech name must be unique',
        },
        validate: {
          notNull: {
            msg: 'Tech name is required',
          },
          notEmpty: {
            msg: 'Tech name cannot be empty',
          },
          len: {
            args: [1, 255],
            msg: 'Tech name must be between 1 and 255 characters',
          },
        },
      },
      icon: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          len: {
            args: [0, 500],
            msg: 'Icon path cannot exceed 500 characters',
          },
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
          len: {
            args: [0, 2000],
            msg: 'Description cannot exceed 2000 characters',
          },
        },
      },
      createdBy: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Tech',
      tableName: 'Techs',
      timestamps: true,
      indexes: [
        {
          name: 'techs_name_idx',
          fields: ['name'],
          unique: true,
        },
        {
          name: 'techs_created_by_idx',
          fields: ['createdBy'],
        },
      ],
    }
  );

  return Tech;
};
