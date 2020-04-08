const fs = require('fs');

export const makeSwaggerOptions = () => {
  const swaggerOptions = JSON.parse(fs.readFileSync('./swagger-options.json'));
  const packageJsonData = JSON.parse(fs.readFileSync('./package.json'));
  swaggerOptions.swaggerDefinition.info.title = packageJsonData.name;
  swaggerOptions.swaggerDefinition.info.description = packageJsonData.description;
  swaggerOptions.swaggerDefinition.info.version = packageJsonData.version;
  return swaggerOptions;  
}