'use strict';
const { Model } = require('sequelize');
const { uuidv7 } = require('uuidv7');

module.exports = (sequelize, DataTypes) => {
  class ProjectContributor extends Model {
    static associate(models) {
      ProjectContributor.belongsTo(models.Project, {
        foreignKey: 'projectId',
        as: 'project',
      });
      ProjectContributor.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'contributor',
      });
    }
  }

  ProjectContributor.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: () => uuidv7(),
      },
      projectId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Projects',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
    },
    {
      sequelize,
      modelName: 'ProjectContributor',
      tableName: 'ProjectContributors',
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['projectId', 'userId'],
          name: 'project_contributors_unique_idx',
        },
        {
          fields: ['projectId'],
          name: 'project_contributors_project_id_idx',
        },
        {
          fields: ['userId'],
          name: 'project_contributors_user_id_idx',
        },
      ],
    }
  );

  return ProjectContributor;
};
