'use strict';
const { Model } = require('sequelize');
const { uuidv7 } = require('uuidv7');

module.exports = (sequelize, DataTypes) => {
  class ProjectTech extends Model {
    static associate(models) {
      ProjectTech.belongsTo(models.Project, {
        foreignKey: 'projectId',
        as: 'project',
      });
      ProjectTech.belongsTo(models.Tech, {
        foreignKey: 'techId',
        as: 'tech',
      });
    }
  }

  ProjectTech.init(
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
      techId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Techs',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
    },
    {
      sequelize,
      modelName: 'ProjectTech',
      tableName: 'ProjectTechs',
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['projectId', 'techId'],
          name: 'project_techs_unique_idx',
        },
        {
          fields: ['projectId'],
          name: 'project_techs_project_id_idx',
        },
        {
          fields: ['techId'],
          name: 'project_techs_tech_id_idx',
        },
      ],
    }
  );

  return ProjectTech;
};
