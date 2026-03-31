import { defineConfig } from '@kubb/core'
import { pluginOas } from '@kubb/plugin-oas'
import { pluginReactQuery } from '@kubb/plugin-react-query'
import { pluginTs } from '@kubb/plugin-ts'

export default defineConfig(() => {
  return {
    root: '.',
    input: {
      path: 'http://localhost:3000/docs/json',
    },
    output: {
      clean: true,
      path: './src/http/generated',
    },
    plugins: [
      pluginOas(),
      pluginTs(),
      pluginReactQuery({
        client: {
          // IMPORTANTE: Usar nosso cliente customizado com autenticação
          importPath: '@/lib/api',
        },
        query: {
          importPath: '@tanstack/react-query',
        },
      }),
    ],
  }
})