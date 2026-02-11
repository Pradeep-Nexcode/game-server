import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';

export default {
  input: 'data/modules/main.ts',
  output: {
    file: 'data/modules/build/main.js',
    format: 'iife',
    name: 'ServerModule',
    footer: [
      'function InitModule(ctx, logger, nk, initializer) { return ServerModule.InitModule(ctx, logger, nk, initializer); }',
      'function matchInit(ctx, logger, nk, params) { return ServerModule.matchInit(ctx, logger, nk, params); }',
      'function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) { return ServerModule.matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata); }',
      'function matchJoin(ctx, logger, nk, dispatcher, tick, state, presence) { return ServerModule.matchJoin(ctx, logger, nk, dispatcher, tick, state, presence); }',
      'function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) { return ServerModule.matchLeave(ctx, logger, nk, dispatcher, tick, state, presences); }',
      'function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) { return ServerModule.matchLoop(ctx, logger, nk, dispatcher, tick, state, messages); }',
      'function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) { return ServerModule.matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds); }',
      'function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) { return ServerModule.matchSignal(ctx, logger, nk, dispatcher, tick, state, data); }',
      'function matchmakerMatched(ctx, logger, nk, matchedUsers) { return ServerModule.matchmakerMatched(ctx, logger, nk, matchedUsers); }',
    ].join('\n')
  },
  plugins: [
    resolve(),
    commonjs(),
    json(),
    typescript({
      compilerOptions: {
        target: 'es5',
        module: 'esnext',
        outDir: undefined,
        declaration: false,
        lib: ['es2015']
      }
    }),
  ],
};
