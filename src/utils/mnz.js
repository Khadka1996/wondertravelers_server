// src/utils/mnz.js
import { logger } from './logger.util.js';

export const printBanner = () => {
  console.log('\n' +
    '                    ███╗   ███╗   ███╗   ██╗   ███████╗\n' +
    '                    ████╗ ████║   ████╗  ██║   ╚══███╔╝\n' +
    '                    ██╔████╔██║   ██╔██╗ ██║     ███╔╝ \n' +
    '                    ██║╚██╔╝██║   ██║╚██╗██║    ███╔╝  \n' +
    '                    ██║ ╚═╝ ██║   ██║ ╚████║   ███████╗\n' +
    '                    ╚═╝     ╚═╝   ╚═╝  ╚═══╝   ╚══════╝\n'
  );
};

export const startServer = (server, PORT, isProd, NODE_ENV) => {
  server.listen(PORT, '0.0.0.0', () => {
    printBanner();

    logger.info(`🚀 Wondertravelers API is running`);
    logger.info(`   Port:          ${PORT}`);
    logger.info(`   Mode:          ${isProd ? 'Production 🔒' : 'Development 🛠️'}`);
    logger.info(`   Environment:   ${NODE_ENV}`);
    logger.info(`   Docs:          http://localhost:${PORT}/api-docs`);
    logger.info(`   Health:        http://localhost:${PORT}/health`);
    logger.info(`   Server time:   ${new Date().toISOString()}`);

    const mem = process.memoryUsage();
    logger.info(`   Heap used:     ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`);
  });
};