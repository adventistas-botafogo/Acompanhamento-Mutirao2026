# Mutirão de Natal 2026 · Placar da arrecadação

Placar online da arrecadação do Mutirão de Natal 2026 da Igreja Adventista de Botafogo ([@adventistasbotafogo](https://www.instagram.com/adventistasbotafogo/)).

**Acesse:** https://adventistas-botafogo.github.io/Acompanhamento-Mutirao2026/

## O que o placar mostra

- **Placar das equipes:** quantas metas cada equipe já bateu e quantas metas abertas ainda faltam.
- **Progresso por item** (Alimentos, Cobertores, Roupas etc.): a meta por equipe, quanto cada equipe arrecadou, a porcentagem da meta e o prazo de cada item.
- **Histórico de parciais:** cada atualização é salva como uma parcial, e as anteriores podem ser consultadas no seletor.

A página atualiza sozinha. Quando a liderança publica uma nova parcial, quem estiver com o placar aberto vê os números novos sem recarregar.

### Equipes

A equipe de cada membro é definida pela inicial do nome:

| Equipe | Iniciais |
|---|---|
| Azul | A a H |
| Laranja | I a P, e Y |
| Verde | Q a Z (exceto Y) |

## Como atualizar os dados (liderança)

1. Abra o placar e, no fim da página, em **Área restrita**, toque em **Entrar com Google**.
2. Toque em **Atualizar dados**. O formulário vem preenchido com os valores da última parcial.
3. Ajuste os valores de cada equipe. Os campos alterados ficam em dourado e mostram quanto mudaram em relação à parcial anterior.
4. Confira o nome e a data da parcial e toque em **Salvar e publicar**.

Se você salvar com uma data nova, o placar cria uma nova parcial e mantém as anteriores. Se salvar com a data de uma parcial que já existe, os dados dela são substituídos.

Só contas Google autorizadas conseguem salvar. Se aparecer a mensagem de que sua conta não está na lista da liderança, fale com o responsável pelo placar.

## Como funciona

O projeto inteiro é um único arquivo, o `index.html`, publicado pelo GitHub Pages. Não há etapa de build nem dependências para instalar.

- **Dados:** ficam no Firebase Firestore, projeto `acompanhamento-mutirao2026`, na coleção `parciais`. Cada documento é uma parcial, e o ID do documento é a data no formato `AAAA-MM-DD`.
- **Login:** Firebase Authentication com Google.
- **Permissões:** as regras de segurança do Firestore definem quem pode escrever. Essas regras ficam configuradas no console do Firebase e não estão neste repositório.

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

## Arquivos

| Arquivo | Descrição |
|---|---|
| `index.html` | Página do placar, com o HTML, o CSS e o JavaScript |
| `logo-mutirao-crop.png` | Logo usado na página, recortado |
| `logo-mutirao.png` | Logo original |

## Manutenção

- **Testar localmente:** abra o `index.html` no navegador. Para o login com Google funcionar fora do GitHub Pages, sirva a pasta por um servidor local (por exemplo `python -m http.server`) e acesse por `http://localhost:8000`.
- **Publicar:** qualquer push para a branch `main` atualiza o site em um ou dois minutos.
- **Mudar de endereço** (domínio próprio ou outro repositório): adicione o novo domínio no console do Firebase, em *Authentication → Settings → Authorized domains*. Sem isso, o login não funciona no endereço novo.
- **Mudar as equipes ou as iniciais:** edite a constante `TEAMS` no `index.html`.
