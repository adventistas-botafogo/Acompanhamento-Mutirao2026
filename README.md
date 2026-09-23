# Mutirão de Natal 2026 · Placar da arrecadação

Placar online e app do Mutirão de Natal 2026 da Igreja Adventista de Botafogo ([@adventistasbotafogo](https://www.instagram.com/adventistasbotafogo/)).

**Acesse:** https://adventistas-botafogo.github.io/Acompanhamento-Mutirao2026/

## O que o app mostra

### Como participar
- **O que trazer:** os itens de doação do próximo sábado, atualizados pela liderança toda semana.
- **Doações via Pix:** a chave Pix com botão de copiar, e o envio do comprovante pelo WhatsApp com a equipe já preenchida na mensagem.
- **Doações via 7me:** o caminho dentro do app 7me e um botão que abre o app, se estiver instalado, ou o site de doação da igreja.

### Acompanhe as parciais
- **Placar das equipes:** quantas metas cada equipe já bateu e quantas metas abertas ainda faltam.
- **Progresso por item** (Alimentos, Roupas, Calçados etc.): a meta por equipe, quanto cada equipe arrecadou, a porcentagem da meta e o prazo de cada item.
- **Histórico de parciais:** cada atualização é salva como uma parcial, e as anteriores podem ser consultadas no seletor.

A página atualiza sozinha. Quando a liderança publica uma nova parcial ou novos itens do sábado, quem estiver com o app aberto vê a mudança sem recarregar.

### Equipes

A equipe de cada membro é definida pela inicial do nome:

| Equipe | Iniciais |
|---|---|
| Azul | A a H |
| Laranja | I a P, e Y |
| Verde | Q a Z (exceto Y) |

## App instalável e avisos

O site pode ser instalado como app (PWA), pelo botão **Instalar app** no topo:
- **Android:** o botão instala direto.
- **iPhone:** o botão mostra como usar *Compartilhar → Adicionar à Tela de Início* no Safari.

O botão **Ativar avisos** inscreve o aparelho para receber notificações. No iPhone, esse botão só aparece dentro do app instalado.

Os avisos são enviados pelo console do Firebase, em **Messaging**. Há campanhas recorrentes semanais programadas:

| Quando | Aviso |
|---|---|
| Domingo | Itens do próximo sábado |
| Quinta | Lembrete para comprar os itens |
| Sábado de manhã | Lembrete de levar as doações |

A lista do sábado precisa estar atualizada no app **antes do aviso de domingo**.

## Como atualizar os dados (liderança)

1. Abra o app e, no fim da página, em **Área restrita**, toque em **Entrar com Google**.
2. **Parciais:** toque em **Atualizar dados**. O formulário vem preenchido com os valores da última parcial, e os campos alterados ficam em dourado, mostrando quanto mudaram. Confira o nome e a data e toque em **Salvar e publicar**.
3. **Itens do sábado:** no card **O que trazer**, toque em **Editar**, escreva um item por linha e salve.

Se você salvar uma parcial com uma data nova, o app cria uma nova parcial e mantém as anteriores. Se salvar com a data de uma parcial que já existe, os dados dela são substituídos.

Só contas Google autorizadas conseguem salvar. Se aparecer a mensagem de que sua conta não tem permissão, fale com o responsável pelo placar.

## Estrutura do projeto

```
index.html              Estrutura da página
css/estilo.css          Visual (cores, layout, responsivo)
js/app.js               Lógica: Firebase, placar, sliders, cards, login, avisos
sw.js                   Service worker: cache offline e recebimento de avisos
manifest.webmanifest    Dados do app instalável (nome, cores, ícones)
img/logos/              Logos usados na página (Mutirão, IASD, Pix, WhatsApp, 7me)
img/icones/             Ícones do app instalado
```

O `sw.js` e o `manifest.webmanifest` ficam na raiz de propósito: o service worker só controla as páginas da pasta onde está.

Não há etapa de build nem dependências para instalar. O GitHub Pages publica os arquivos como estão.

## Firebase

Projeto `acompanhamento-mutirao2026`.

| Coleção | Conteúdo | Quem escreve |
|---|---|---|
| `parciais` | Uma parcial por documento, com ID no formato `AAAA-MM-DD` | Liderança |
| `avisos` | Documento `sabado`, com os itens do próximo sábado | Liderança |
| `inscritos` | Um documento por aparelho inscrito nos avisos. O ID é o token do Firebase Cloud Messaging | O próprio aparelho, ao ativar os avisos |

- **Login:** Firebase Authentication com Google.
- **Avisos:** Firebase Cloud Messaging. A chave Web Push (VAPID) está em `js/app.js`.
- **Permissões:** as regras de segurança do Firestore ficam no console do Firebase e não estão neste repositório. A lista de e-mails da liderança fica na função `ehLideranca()`.

### Estrutura de uma parcial

```js
{
  titulo: "1ª parcial",
  data: "2026-09-18",
  itens: [
    {
      nome: "Alimentos",
      meta: 3000,            // meta por equipe
      unidade: "kg",
      prazo: "2026-12-05T21:00:00.000Z",
      valores: { azul: 1883.8, laranja: 3434.8, verde: 963.8 }
    }
  ],
  atualizadoEm: "2026-09-23T17:36:00.000Z",
  atualizadoPor: "email@exemplo.com"
}
```

## Manutenção

- **Testar localmente:** sirva a pasta com um servidor local, por exemplo `python -m http.server`, e acesse `http://localhost:8000`. Abrir o `index.html` direto do disco não funciona, porque o navegador bloqueia o `js/app.js` fora de um servidor.
- **Publicar:** qualquer push para a branch `main` atualiza o site em um ou dois minutos.
- **Arquivo novo ou renomeado:** se ele precisar funcionar sem internet, adicione-o à lista `ARQUIVOS` do `sw.js` e aumente a versão em `CACHE` (por exemplo, de `mutirao-v3` para `mutirao-v4`).
- **Mudar de endereço** (domínio próprio ou outro repositório): adicione o novo domínio no console do Firebase, em *Authentication → Settings → Authorized domains*. Sem isso, o login não funciona no endereço novo.
- **Configurações que ficam em `js/app.js`:**
  - `TEAMS`: equipes, iniciais e emoji usado na mensagem do WhatsApp.
  - `PIX`: chave Pix e número do WhatsApp para comprovantes.
  - `SETEME`: link de doação da igreja no 7me, links das lojas e caminho dentro do app.
