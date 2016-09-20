# NodeJs MySQL Demo程序

简单的调用mysql进行数据查询，获取到相应的数据之后，进行数据处理整合，然后生成对应的sql语句，用到的模块有readline、fs、mysql、config

config配置可以自己编写一个配置文件，`production.json`，用于实际调试环境，先运行`export NODE_ENV=production`，然后执行`npm run es6`