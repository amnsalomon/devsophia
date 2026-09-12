# SophIA — Guia de Integração / Interviews API

Site estático em português, pronto para hospedagem no GitHub Pages. Não exige instalação, compilação, banco de dados ou servidor de aplicação.

## Arquivos

- `index.html`: documentação integral e estrutura da página.
- `styles.css`: identidade visual, responsividade e impressão.
- `script.js`: busca local, menu, indicação da seção em leitura e cópia dos exemplos.
- `assets/favicon.svg`: o “S” utilizado também no site da StarMind.
- `guia-integracao-original.md`: cópia byte a byte do caderno enviado, sem alterações.
- `.nojekyll`: permite servir diretamente os arquivos estáticos no GitHub Pages.

## Publicação no GitHub

Extraia este ZIP e coloque os arquivos na raiz do repositório, mantendo a pasta `assets` e o arquivo `index.html` nesse nível. Configure o GitHub Pages para publicar a raiz dessa branch. Não envie apenas o ZIP: envie o conteúdo extraído.

Os caminhos dos recursos são relativos, portanto o site funciona tanto no endereço de um projeto quanto em um domínio próprio. Nenhum domínio foi fixado nesta entrega.

Para consultar antes de publicar, abra `index.html` no navegador. A documentação e a busca funcionam localmente. A cópia automática depende das permissões do navegador; se ela não for permitida, o site seleciona o código e avisa para usar o comando copiar.

## Conteúdo e manutenção

Fonte: “Guia de Integração — Interviews API”, versão 2.1.0, atualização de setembro de 2026, conforme o caderno fornecido. Foram mantidos os 14 assuntos, todas as tabelas e todos os exemplos, inclusive as notas e ressalvas do original. Foram acrescentados somente elementos de navegação e apresentação.

O site apresenta os exemplos como documentação: ele não executa integrações, não consulta a API e não coleta credenciais. As chaves ilustrativas dos exemplos são as que constam no documento recebido. Nenhuma credencial operacional deve ser inserida no site; siga a seção de autenticação do próprio guia.

Para atualizar a documentação, edite o conteúdo correspondente em `index.html` e mantenha `guia-integracao-original.md` alinhado com a nova fonte aprovada. A busca lê o conteúdo do HTML e se atualiza automaticamente. Se acrescentar assuntos, ajuste também os links da navegação lateral. Para alterar cores e tipografia, edite as variáveis no início de `styles.css`.

Todos os recursos visuais são locais. Não há fontes remotas, analytics, cookies, formulários ou dependências externas de execução.
