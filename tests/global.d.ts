// 测试文件偶尔需要读写 process.env(如强制时区跑时区相关回归测试)。
// 项目本身不依赖 @types/node(纯浏览器库),这里只声明测试用得到的最小子集。
declare const process: {
  env: Record<string, string | undefined>
}
