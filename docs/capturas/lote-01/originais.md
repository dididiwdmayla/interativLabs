# Lote 01 — originais

Extração binária dos dois zips, sem recompressão. SHA-256 do arquivo extraído conferido com os bytes da entrada no zip. Cantos: máximo dos canais RGB em quadrados de 16×16 px, na ordem superior esquerdo, superior direito, inferior esquerdo, inferior direito.

| ID | Dimensões | Modo | Bytes | Máximos nos cantos | SHA-256 | Origem |
| --- | --- | --- | --- | --- | --- | --- |
| `fx-exhaust` | 1254×1254 | RGB | 587019 | [1, 1, 1, 1] | `c89c98ee1008a1085340f90aae752b0ddff126b401a1dfc363fe6ef7a81fd6bb` | `lote-01-parte-1.zip` |
| `fx-gas` | 1254×1254 | RGB | 2581203 | [253, 255, 255, 255] | `6a4a37e104bc94351acb47bfdfb86c4eaf091be0ac817162b6dcad57b5a22b50` | `lote-01-parte-2.zip` |
| `fx-spark` | 1536×1024 | RGB | 340761 | [1, 1, 1, 1] | `bfec80bf55b13600fe5bd04f76108ec7c677f407bedf442731f784d03f1fa837` | `lote-01-parte-1.zip` |
| `hatch-wood` | 1254×1254 | RGB | 1639560 | [254, 253, 9, 174] | `7efa391fa508f7e6a12cf2e2ba1cd05b101e0d1d621c6c75e2061d12ba846439` | `lote-01-parte-1.zip` |
| `hw-axle` | 1254×1254 | RGB | 2099456 | [1, 2, 5, 3] | `b88ba7dccc3a2b620e70dbe3a8f2709edf0d8524efa2e7fbb6b30bcc407505ca` | `lote-01-parte-2.zip` |
| `hw-bearing` | 1254×1254 | RGB | 2054681 | [1, 1, 3, 1] | `a1b704b6d12925c0e6ebc7c412240b6b51a77afcea23b5bd775f4d9b8f5624cd` | `lote-01-parte-1.zip` |
| `hw-pin` | 1254×1254 | RGB | 2470612 | [1, 1, 5, 4] | `ae455645fb18b556a89193796621a0ed4111d11fe93459dbcfc3a2297cf85e06` | `lote-01-parte-2.zip` |
| `hw-rivet` | 1254×1254 | RGB | 2136058 | [2, 2, 2, 4] | `b41fdded4b25e9c7fe7a84e57cfb38a2a088bca734d00252c763ff718764c9da` | `lote-01-parte-1.zip` |
| `hw-screw-hex` | 1254×1254 | RGB | 2653021 | [1, 1, 3, 1] | `7a0f0d52f4f8d4f94122803929dbeaf7a7cfd7116f0bdf259158395351e8ed2d` | `lote-01-parte-1.zip` |
| `hw-screw-slot` | 1254×1254 | RGB | 2135963 | [1, 1, 3, 1] | `f56ee36a1959a929cd5a27f95581e5ff4069bc4c56b6044a757015dccb6dfa10` | `lote-01-parte-2.zip` |
| `hw-sensor` | 1254×1254 | RGB | 1716059 | [1, 1, 3, 1] | `75f6e273b180efb223698820645fd8b761de5db9cc6ecb0db348350618fdd550` | `lote-01-parte-2.zip` |
| `mask-develop` | 1536×1024 | RGB | 866184 | [255, 1, 255, 2] | `35f79816da700fe135b28169393c543ec82fbf4bf89087b6ab45f7645e830fe8` | `lote-01-parte-2.zip` |
| `paper-stage` | 1254×1254 | RGB | 2114122 | [81, 69, 76, 70] | `ca4a1cec9f91e51d7e060a46ae6afbe03294d94329de068bed5a719c980d9722` | `lote-01-parte-1.zip` |
| `scene-entry` | 1024×1536 | RGBA | 2298077 | [1, 1, 3, 2] | `0ff1216d6eca5582521fe2473851a20bccac9be1cf109655cb77bf4e604f0765` | `lote-01-parte-1.zip` |
| `spring-coil` | 1536×1024 | RGB | 1553721 | [1, 1, 3, 1] | `04fdfb7e40e8b7a9cb2deff88e53e32307d610a3444339dce583c47444d55ee7` | `lote-01-parte-2.zip` |
| `spring-end` | 1536×1024 | RGB | 1482498 | [1, 1, 3, 1] | `488da46e34c66386dfe19ae0e68b96f47f2e2ebaa0832e873fc08def7cbe6117` | `lote-01-parte-1.zip` |
| `tex-ink-wear` | 1254×1254 | RGB | 1704807 | [126, 155, 3, 4] | `cab2ebf7caae44bc646fb24c7eb0045ccb3d16a81cad9b169a9f70aed5af4510` | `lote-01-parte-2.zip` |

Os mestres quadrados têm 1254×1254, acima dos 1024×1024 previstos na coluna “Gerar”; o pipeline usa as dimensões reais. `mask-develop` é RGB e será convertida para L na leitura do processamento.
