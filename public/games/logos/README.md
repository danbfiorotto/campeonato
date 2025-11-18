# Logos dos Jogos

Esta pasta contém os logos dos jogos que serão utilizados no sistema.

## Estrutura Recomendada

Adicione os logos seguindo o padrão de nomenclatura:

```
logo-{slug-do-jogo}.{extensão}
```

### Exemplos:
- `logo-lol.png` - Logo do League of Legends
- `logo-r6.png` - Logo do Rainbow Six Siege
- `logo-valorant.png` - Logo do Valorant
- `logo-cs.png` - Logo do Counter-Strike
- `logo-brawlhalla.png` - Logo do Brawlhalla

## Formatos Suportados

- PNG (recomendado para logos com transparência)
- JPG/JPEG (para logos sem transparência)
- SVG (para logos vetoriais)

## Tamanho Recomendado

- **Tamanho ideal**: 512x512px ou 1024x1024px
- **Formato**: Quadrado ou proporção 1:1
- **Resolução**: Mínimo 256x256px para boa qualidade

## Como Usar

Os logos podem ser acessados via URL:

```tsx
// Exemplo de uso em componentes React/Next.js
<Image 
  src="/games/logos/logo-lol.png" 
  alt="League of Legends"
  width={64}
  height={64}
/>
```

## Notas

- Mantenha os arquivos organizados e com nomes descritivos
- Use o slug do jogo (mesmo do banco de dados) para facilitar a associação
- Comprima as imagens antes de adicionar para otimizar o carregamento

