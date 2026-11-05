import { useId } from "react";
import { Icon } from "./icons";
import { Sheet } from "./Sheet";

/**
 * iPhone: não há tela cheia de página nem trava de orientação. A tela
 * cheia vem do app instalado, aberto pela tela de início.
 */
export function InstallSheet() {
  const uid = useId();
  return (
    <Sheet title="Tela cheia no iPhone" side="menu" className="sheet--install">
      <p className="sheet__lede">
        No iPhone, a tela cheia vem do app instalado: no Safari, toque em Compartilhar e depois em Adicionar à
        Tela de Início. Abra pelo ícone novo, com o celular deitado.
      </p>
      <ol className="steps">
        <li>
          <span className="steps__icon">
            <Icon name="share" uid={`${uid}s`} />
          </span>
          Compartilhar
        </li>
        <li>
          <span className="steps__icon">
            <Icon name="plus" uid={`${uid}p`} />
          </span>
          Adicionar à Tela de Início
        </li>
        <li>
          <span className="steps__icon">
            <Icon name="gear" uid={`${uid}g`} />
          </span>
          Abrir pelo ícone interativLabs
        </li>
      </ol>
    </Sheet>
  );
}
