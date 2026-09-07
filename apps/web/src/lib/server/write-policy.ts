import { env } from '$env/dynamic/private'
import type { WritePolicy } from '@ecole2recte/protocol'

/**
 * Quelles écritures sont ouvertes, et jusqu'où.
 *
 * Deux verrous, et il faut les deux. La **police** dit ce que le client s'autorise en
 * général ; l'**interrupteur par fonctionnalité** dit laquelle a passé son aller-retour
 * réel. Une fonction dont l'aller-retour n'est pas vert reste absente de l'interface, même
 * si la police est ouverte : c'est ce qui empêche un message tronqué de partir chez un
 * professeur parce qu'on avait « activé l'écriture » un soir.
 *
 * Rien n'est ouvert par défaut. Ce n'est pas de la prudence décorative : rendre un devoir
 * est irréversible, et un message envoyé ne se rattrape pas.
 */
export type WriteFeature =
  | 'homework-done'
  | 'homework-comment'
  | 'cloud-folder'
  | 'cloud-rename'
  | 'cloud-delete'

export const WRITE_FEATURE_LABELS: Record<WriteFeature, string> = {
  'homework-done': 'Cocher un devoir',
  'homework-comment': 'Commenter un devoir',
  'cloud-folder': 'Créer un dossier',
  'cloud-rename': 'Renommer un fichier',
  'cloud-delete': 'Supprimer un fichier',
}

export function writePolicy(): WritePolicy {
  const value = (env['ED_WRITE_POLICY'] ?? '').trim().toLowerCase()
  return value === 'allow' || value === 'dry-run' ? value : 'deny'
}

function enabledFeatures(): Set<string> {
  const raw = env['ED_WRITE_FEATURES'] ?? ''
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry !== ''),
  )
}

/** Vrai seulement si la police l'autorise **et** que la fonctionnalité a été ouverte. */
export function isWriteEnabled(feature: WriteFeature): boolean {
  if (writePolicy() === 'deny') return false
  const features = enabledFeatures()
  return features.has('all') || features.has(feature)
}

export function enabledWriteFeatures(): WriteFeature[] {
  return (Object.keys(WRITE_FEATURE_LABELS) as WriteFeature[]).filter((feature) => isWriteEnabled(feature))
}
