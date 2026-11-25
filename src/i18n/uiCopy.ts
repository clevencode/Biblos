/**
 * Dicionário UI consumer — FR / HT (Kreyòl Ayisyen).
 */

import type { UiLocale } from "./uiLocale";

export type UiCopyKey =
  | "shell.nav"
  | "shell.home"
  | "shell.plan"
  | "shell.bible"
  | "shell.profile"
  | "shell.admin"
  | "common.close"
  | "common.back"
  | "common.clear"
  | "common.confirm"
  | "common.cancel"
  | "common.reload"
  | "common.error"
  | "common.loading"
  | "common.book"
  | "common.chapters"
  | "home.greeting.morning"
  | "home.greeting.afternoon"
  | "home.greeting.evening"
  | "home.continue"
  | "home.openBible"
  | "home.dailyVerse"
  | "home.share"
  | "home.plans"
  | "home.resumePlan"
  | "home.discoverPlans"
  | "home.read"
  | "home.seeAll"
  | "home.days"
  | "home.plansEmpty"
  | "home.browsePlans"
  | "plan.title"
  | "plan.discover"
  | "plan.myPlans"
  | "plan.findPlans"
  | "plan.dayOf"
  | "plan.daysCount"
  | "plan.mineEmpty"
  | "plan.continue"
  | "plan.review"
  | "plan.returnAction"
  | "plan.returnToPlans"
  | "plan.stages"
  | "plan.days"
  | "plan.today"
  | "plan.dayReading"
  | "plan.dayPassage"
  | "plan.empty"
  | "plan.resume"
  | "plan.start"
  | "plan.inProgress"
  | "plan.all"
  | "plan.emptyHint"
  | "plan.emptyPublishedHint"
  | "plan.catalogError"
  | "plan.catalogErrorHint"
  | "plan.offline"
  | "plan.offlineHint"
  | "plan.retry"
  | "plan.firebaseMissing"
  | "profile.title"
  | "profile.history"
  | "profile.clearHistory"
  | "profile.clearHistoryConfirm"
  | "profile.signIn"
  | "profile.signOut"
  | "profile.connectAccount"
  | "profile.tab.account"
  | "profile.tab.prefs"
  | "profile.tab.storage"
  | "profile.tab.history"
  | "profile.tab.admin"
  | "profile.account"
  | "auth.titleUpgrade"
  | "auth.titleSoftGate"
  | "auth.leadUpgrade"
  | "auth.leadSoftGate"
  | "auth.google"
  | "auth.or"
  | "auth.email"
  | "auth.password"
  | "auth.signIn"
  | "auth.register"
  | "auth.sendLink"
  | "auth.createAccount"
  | "auth.forgotPassword"
  | "auth.backToSignIn"
  | "auth.later"
  | "auth.resetSent"
  | "auth.errorEmail"
  | "auth.errorPassword"
  | "auth.showPassword"
  | "auth.hidePassword"
  | "auth.error.generic"
  | "auth.error.invalidCredential"
  | "auth.error.wrongPassword"
  | "auth.error.userNotFound"
  | "auth.error.emailInUse"
  | "auth.error.weakPassword"
  | "auth.error.tooManyRequests"
  | "auth.error.network"
  | "auth.error.popupClosed"
  | "auth.error.missingToken"
  | "auth.error.nativeConfig"
  | "auth.signOutConfirm"
  | "auth.signOutConfirmOffline"
  | "auth.signOutConfirmAction"
  | "onboarding.welcomeTitle"
  | "onboarding.welcomeLead"
  | "onboarding.fullName"
  | "onboarding.errorName"
  | "onboarding.submit"
  | "onboarding.cancel"
  | "toast.offline"
  | "toast.markSaved"
  | "profile.theme"
  | "profile.settings"
  | "profile.appearance"
  | "profile.language"
  | "profile.langFr"
  | "profile.langHt"
  | "profile.themeLight"
  | "profile.themeDark"
  | "profile.themeSystem"
  | "profile.storage"
  | "profile.storageCache"
  | "profile.download"
  | "profile.ready"
  | "profile.historyEmpty"
  | "profile.marks"
  | "profile.marksEmpty"
  | "profile.calculating"
  | "profile.guestSaveTitle"
  | "profile.guestSaveLead"
  | "profile.quotaHint"
  | "profile.saveName"
  | "profile.connectedAccount"
  | "profile.group.bible"
  | "profile.group.reading"
  | "profile.group.library"
  | "profile.readingChromeHint"
  | "profile.deleteAccount"
  | "profile.deleteAccountConfirm"
  | "profile.deleteAccountAction"
  | "profile.accountNameWithBadge"
  | "history.title"
  | "history.empty"
  | "history.recent"
  | "history.clearAll"
  | "history.clearAllConfirm"
  | "history.delete"
  | "history.close"
  | "history.count"
  | "history.countOne"
  | "bible.searchWord"
  | "bible.history"
  | "bible.prevChapter"
  | "bible.nextChapter"
  | "bible.chapters"
  | "bible.chapterN"
  | "bible.bookChapter"
  | "bible.nav"
  | "bible.menu"
  | "bible.menuBible"
  | "bible.version"
  | "bible.versionGroup"
  | "bible.tools"
  | "bible.offlineReady"
  | "bible.offlineDownload"
  | "bible.offlineDownloading"
  | "bible.offlineBusy"
  | "bible.fontSize"
  | "bible.fontSmaller"
  | "bible.fontLarger"
  | "bible.text"
  | "bible.planProgress"
  | "bible.planPrev"
  | "bible.planNext"
  | "bible.planStage"
  | "bible.planDay"
  | "bible.audioPlayer"
  | "plan.personalNote"
  | "plan.personalNoteLead"
  | "plan.personalNoteHint"
  | "plan.personalNoteDone"
  | "plan.personalNoteSave"
  | "plan.readerNoteLead"
  | "plan.readerNoteLeadStage"
  | "plan.completeTitle"
  | "plan.completeLead"
  | "offline.title"
  | "offline.lead"
  | "offline.reconnectTitle"
  | "offline.reconnectLead"
  | "offline.downloading"
  | "offline.waiting"
  | "offline.downloadCta"
  | "swUpdate.title"
  | "swUpdate.lead"
  | "swUpdate.cta"
  | "pwaInstall.title"
  | "pwaInstall.lead"
  | "pwaInstall.apkLead"
  | "pwaInstall.iosLead"
  | "pwaInstall.cta"
  | "pwaInstall.apkCta"
  | "pwaInstall.busy"
  | "searchBooks.title"
  | "searchBooks.back"
  | "searchBooks.close"
  | "searchBooks.placeholder"
  | "searchBooks.search"
  | "searchBooks.empty"
  | "searchBooks.chapters"
  | "searchBooks.chAbbr"
  | "searchBooks.chaptersCount"
  | "study.title"
  | "study.close"
  | "study.context"
  | "study.refs"
  | "study.crossRefs"
  | "study.application"
  | "study.notes"
  | "study.tabs"
  | "study.notesLabel"
  | "study.contextEmpty"
  | "study.appEmpty"
  | "study.refsEmpty"
  | "study.notesPlaceholder"
  | "study.notesSaved"
  | "study.notesDraft"
  | "study.loadError"
  | "study.refUnavailable"
  | "study.goToPassage"
  | "study.goToChapter"
  | "study.returnToVerse"
  | "study.returnToLabel"
  | "study.returnAction"
  | "study.returnStackDepth"
  | "study.dismissStudyJump"
  | "verse.actions"
  | "verse.passageOptions"
  | "verse.hint"
  | "verse.hintMulti"
  | "verse.selectTitle"
  | "verse.tabVerse"
  | "verse.tabRefs"
  | "verse.mark"
  | "verse.unmark"
  | "verse.markDone"
  | "verse.unmarkDone"
  | "verse.keepOne"
  | "verse.share"
  | "verse.shareCopied"
  | "verse.shareFailed"
  | "verse.colorTitle"
  | "word.placeholder"
  | "word.aria"
  | "word.panel"
  | "word.short"
  | "word.ot"
  | "word.nt"
  | "word.dc"
  | "word.recents"
  | "word.suggestions"
  | "word.filterBook"
  | "word.apply"
  | "word.showAll"
  | "word.partial"
  | "word.range"
  | "word.count"
  | "word.pagination"
  | "word.page"
  | "word.empty"
  | "word.emptyInBook"
  | "word.outsideBook"
  | "word.emptyBooks"
  | "word.fuzzy"
  | "word.or"
  | "word.unavailable";

type Dict = Record<UiCopyKey, string>;

const FR: Dict = {
  "shell.nav": "Navigation",
  "shell.home": "Accueil",
  "shell.plan": "Plan",
  "shell.bible": "Bible",
  "shell.profile": "Profil",
  "shell.admin": "Admin",
  "common.close": "Fermer",
  "common.back": "Retour",
  "common.clear": "Effacer",
  "common.confirm": "Confirmer ?",
  "common.cancel": "Annuler",
  "common.reload": "Recharger",
  "common.error": "Une erreur est survenue",
  "common.loading": "Chargement…",
  "common.book": "Livre",
  "common.chapters": "Chapitres",
  "home.greeting.morning": "Bonjour",
  "home.greeting.afternoon": "Bon après-midi",
  "home.greeting.evening": "Bonsoir",
  "home.continue": "Continuer la lecture",
  "home.openBible": "Ouvrir la Bible",
  "home.dailyVerse": "Verset du jour",
  "home.share": "Partager",
  "home.plans": "Plans de lecture",
  "home.resumePlan": "Reprendre",
  "home.discoverPlans": "Découvrir les plans",
  "home.read": "Lire",
  "home.seeAll": "Voir tout",
  "home.days": "{done}/{total} jours",
  "home.plansEmpty": "Choisissez un parcours guidé dans l’onglet Plan.",
  "home.browsePlans": "Parcourir les plans",
  "plan.title": "Plans",
  "plan.discover": "Découvrir",
  "plan.myPlans": "Mes plans",
  "plan.findPlans": "Découvrir",
  "plan.dayOf": "Jour {done} sur {total}",
  "plan.daysCount": "{total} jours",
  "plan.mineEmpty": "Vous n’avez pas encore de plan en cours.",
  "plan.continue": "Continuer",
  "plan.review": "Revoir",
  "plan.returnAction": "Retour",
  "plan.returnToPlans": "Plans",
  "plan.stages": "Étapes",
  "plan.days": "Jours",
  "plan.today": "Aujourd’hui",
  "plan.dayReading": "Lecture du jour",
  "plan.dayPassage": "Passage du jour",
  "plan.empty": "Aucun plan disponible",
  "plan.resume": "Reprendre",
  "plan.start": "Commencer",
  "plan.inProgress": "En cours",
  "plan.all": "Tous les plans",
  "plan.emptyHint":
    "Les parcours guidés apparaîtront ici dès qu’ils seront publiés.",
  "plan.emptyPublishedHint":
    "Aucun parcours publié pour le moment. Vérifiez la connexion ou réessayez.",
  "plan.catalogError": "Catalogue indisponible",
  "plan.catalogErrorHint": "Impossible de charger les plans pour le moment.",
  "plan.offline": "Plans hors ligne",
  "plan.offlineHint":
    "Le catalogue n’est pas configuré sur cet appareil. Vous pouvez toujours ouvrir la Bible.",
  "plan.retry": "Réessayer",
  "plan.firebaseMissing":
    "Firebase n’est pas inclus dans cette build. Recompilez l’APK avec VITE_FIREBASE_* dans .env.",
  "profile.title": "Profil",
  "profile.history": "Historique",
  "profile.clearHistory": "Effacer",
  "profile.clearHistoryConfirm": "Confirmer ?",
  "profile.signIn": "Se connecter",
  "profile.signOut": "Se déconnecter",
  "profile.connectAccount": "Connecter un compte",
  "profile.tab.account": "Compte",
  "profile.tab.prefs": "Préfs",
  "profile.tab.storage": "Stockage",
  "profile.tab.history": "Historique",
  "profile.tab.admin": "Admin",
  "profile.account": "Compte",
  "auth.titleUpgrade": "Sauvegarder mes études",
  "auth.titleSoftGate": "Garde tes surlignages",
  "auth.leadUpgrade":
    "Connecte-toi avec Google pour synchroniser marques, notes et plans entre tes appareils.",
  "auth.leadSoftGate":
    "En mode invité, tu peux marquer jusqu’à 10 versets sur cet appareil. Connecte Google pour continuer et retrouver tes surlignages partout.",
  "auth.google": "Continuer avec Google",
  "auth.or": "ou",
  "auth.email": "E-mail",
  "auth.password": "Mot de passe",
  "auth.signIn": "Se connecter",
  "auth.register": "Créer un compte",
  "auth.sendLink": "Envoyer le lien",
  "auth.createAccount": "Créer un compte",
  "auth.forgotPassword": "Mot de passe oublié ?",
  "auth.backToSignIn": "Retour à la connexion",
  "auth.later": "Plus tard",
  "auth.resetSent":
    "E-mail de réinitialisation envoyé. Vérifie ta boîte de réception.",
  "auth.errorEmail": "Indique ton e-mail.",
  "auth.errorPassword": "Mot de passe : au moins 6 caractères.",
  "auth.showPassword": "Afficher le mot de passe",
  "auth.hidePassword": "Masquer le mot de passe",
  "auth.error.generic": "Connexion impossible. Réessaie dans un instant.",
  "auth.error.invalidCredential":
    "E-mail ou mot de passe incorrect.",
  "auth.error.wrongPassword": "Mot de passe incorrect.",
  "auth.error.userNotFound": "Aucun compte trouvé pour cet e-mail.",
  "auth.error.emailInUse": "Cet e-mail est déjà associé à un compte.",
  "auth.error.weakPassword":
    "Mot de passe trop faible (au moins 6 caractères).",
  "auth.error.tooManyRequests":
    "Trop de tentatives. Réessaie plus tard.",
  "auth.error.network": "Réseau indisponible. Vérifie ta connexion.",
  "auth.error.popupClosed": "Connexion annulée.",
  "auth.error.missingToken":
    "Connexion Google incomplète (jeton manquant). Vérifie google-services.json sur l’APK.",
  "auth.error.nativeConfig":
    "Google Sign-In mal configuré (SHA-1/256 ou google-services.json). Vérifie Firebase Console.",
  "auth.signOutConfirm":
    "Tes données synchronisées restent en sécurité dans le cloud et reviendront à la prochaine connexion. Elles seront retirées de cet appareil.",
  "auth.signOutConfirmOffline":
    "Tu es hors ligne : les modifications pas encore envoyées peuvent être perdues.",
  "auth.signOutConfirmAction": "Se déconnecter de cet appareil",
  "onboarding.welcomeTitle": "Bienvenue",
  "onboarding.welcomeLead":
    "Confirme ou ajuste ton nom. Ton compte synchronise tes données entre appareils.",
  "onboarding.fullName": "Nom complet",
  "onboarding.errorName": "Indique ton nom complet pour continuer.",
  "onboarding.submit": "Continuer",
  "onboarding.cancel": "Annuler",
  "toast.offline": "Hors ligne — tout reste enregistré sur cet appareil.",
  "toast.markSaved": "Surlignage enregistré",
  "profile.theme": "Thème",
  "profile.settings": "Préférences",
  "profile.appearance": "Apparence",
  "profile.language": "Langue",
  "profile.langFr": "Français",
  "profile.langHt": "Kreyòl",
  "profile.themeLight": "Clair",
  "profile.themeDark": "Sombre",
  "profile.themeSystem": "Système",
  "profile.storage": "Stockage",
  "profile.storageCache": "Cache",
  "profile.download": "Télécharger",
  "profile.ready": "Prêt",
  "profile.historyEmpty": "Aucune lecture enregistrée pour le moment.",
  "profile.marks": "Surlignages",
  "profile.marksEmpty": "Aucun verset surligné pour le moment.",
  "profile.calculating": "Calcul…",
  "profile.guestSaveTitle": "Sauvegarder mes études",
  "profile.guestSaveLead":
    "Connecte Google pour synchroniser tes marques, notes et plans.",
  "profile.quotaHint":
    "{used}/{total} surlignages — relie un compte pour continuer sereinement",
  "profile.saveName": "Enregistrer",
  "profile.connectedAccount": "Compte connecté",
  "profile.group.bible": "Bible",
  "profile.group.reading": "Lecture",
  "profile.group.library": "Bibliothèque",
  "profile.readingChromeHint":
    "Ouvre la Bible une fois pour régler version et typographie ici.",
  "profile.deleteAccount": "Supprimer mon compte",
  "profile.deleteAccountConfirm":
    "Les bibles S21/HT98 resteront sur l’appareil. Tes données cloud et locales personnelles seront effacées.",
  "profile.deleteAccountAction": "Confirmer la suppression",
  "profile.accountNameWithBadge": "{name} (Assinante)",
  "history.title": "Historique",
  "history.empty": "Aucune lecture enregistrée pour l’instant.",
  "history.recent": "Chapitres ouverts récemment",
  "history.clearAll": "Effacer tout",
  "history.clearAllConfirm": "Effacer tout l’historique de lecture ?",
  "history.delete": "Supprimer",
  "history.close": "Fermer l’historique",
  "history.count": "{n} lectures",
  "history.countOne": "{n} lecture",
  "bible.searchWord": "Rechercher un mot dans la Bible",
  "bible.history": "Historique",
  "bible.prevChapter": "Chapitre précédent",
  "bible.nextChapter": "Chapitre suivant",
  "bible.chapters": "Chapitres",
  "bible.chapterN": "Chapitre {n}",
  "bible.bookChapter": "Livre et chapitre",
  "bible.nav": "Navigation biblique",
  "bible.menu": "Menu",
  "bible.menuBible": "Menu Bible",
  "bible.version": "Version",
  "bible.versionGroup": "Version de la Bible",
  "bible.tools": "Outils",
  "bible.offlineReady": "Bible hors ligne",
  "bible.offlineDownload": "Télécharger hors ligne",
  "bible.offlineDownloading": "Téléchargement… {done}/{total}",
  "bible.offlineBusy":
    "Téléchargement… {done}/{total} (toucher pour annuler)",
  "bible.fontSize": "Taille du texte",
  "bible.fontSmaller": "Réduire la taille du texte",
  "bible.fontLarger": "Augmenter la taille du texte",
  "bible.text": "Texte",
  "bible.planProgress": "Progression du plan",
  "bible.planPrev": "Passage précédent du plan",
  "bible.planNext": "Passage suivant du plan",
  "bible.planStage": "Étape {n}",
  "bible.planDay": "Jour {n}",
  "bible.audioPlayer": "Lecteur audio",
  "plan.personalNote": "Note personnelle",
  "plan.personalNoteLead":
    "Note personnelle — ajoute une réflexion (optionnel).",
  "plan.personalNoteHint": "Optionnelle · hors du parcours de lecture",
  "plan.personalNoteDone": "Écrite",
  "plan.personalNoteSave": "Enregistrer",
  "plan.readerNoteLead":
    "Jour terminé — ajoute une réflexion (optionnel).",
  "plan.readerNoteLeadStage":
    "Étape terminée — ajoute une note personnelle (optionnel).",
  "plan.completeTitle": "Plan terminé",
  "plan.completeLead":
    "Tu as parcouru tout le parcours. Tu peux le relire quand tu veux.",
  "offline.title": "Chapitre hors ligne indisponible",
  "offline.lead":
    "Ce chapitre doit être téléchargé pour une lecture sans connexion. Vos marques et l’avancement restent enregistrés sur l’appareil.",
  "offline.reconnectTitle": "Connexion requise pour télécharger",
  "offline.reconnectLead":
    "Cette version n’est pas encore disponible hors ligne. Reconnectez-vous pour la télécharger ; ensuite la lecture et la recherche fonctionneront sans réseau.",
  "offline.downloading": "Téléchargement…",
  "offline.waiting": "En attente de connexion",
  "offline.downloadCta": "Télécharger la Bible hors ligne",
  "swUpdate.title": "Nouvelle version",
  "swUpdate.lead": "Une mise à jour est prête à installer.",
  "swUpdate.cta": "Mettre à jour",
  "pwaInstall.title": "Installer l’app Biblos",
  "pwaInstall.lead":
    "Ajoute Biblos à l’écran d’accueil pour l’ouvrir comme une application.",
  "pwaInstall.apkLead":
    "Télécharge l’APK Android pour installer Biblos hors du navigateur.",
  "pwaInstall.iosLead":
    "Touche Partager, puis « Sur l’écran d’accueil ».",
  "pwaInstall.cta": "Installer l’app",
  "pwaInstall.apkCta": "Télécharger l’app (APK)",
  "pwaInstall.busy": "Installation…",
  "searchBooks.title": "Livres",
  "searchBooks.back": "Retour aux livres",
  "searchBooks.close": "Fermer",
  "searchBooks.placeholder": "Genèse, Psaumes, Jean…",
  "searchBooks.search": "Rechercher un livre",
  "searchBooks.empty": "Aucun livre",
  "searchBooks.chapters": "Chapitres",
  "searchBooks.chAbbr": "{n} ch.",
  "searchBooks.chaptersCount": "{n} chapitre(s)",
  "study.title": "Étude",
  "study.close": "Fermer l’étude",
  "study.context": "Contexte",
  "study.refs": "Références",
  "study.crossRefs": "Référence croisée",
  "study.application": "Application",
  "study.notes": "Notes",
  "study.tabs": "Sections d’étude",
  "study.notesLabel": "Mes notes",
  "study.contextEmpty": "Contexte historique non disponible pour ce verset.",
  "study.appEmpty": "Application pratique à venir pour ce passage.",
  "study.refsEmpty": "Aucune référence croisée pour ce verset.",
  "study.notesPlaceholder": "Écrire une note personnelle…",
  "study.notesSaved": "Enregistré · sync si connecté",
  "study.notesDraft": "Brouillon local",
  "study.loadError": "Erreur de chargement",
  "study.refUnavailable": "Texte de ce passage indisponible pour cette version.",
  "study.goToPassage": "Aller au verset",
  "study.goToChapter": "Aller au chapitre",
  "study.returnToVerse": "Retourner aux références",
  "study.returnToLabel": "Retourner à {label}",
  "study.returnAction": "Retourner à",
  "study.returnStackDepth": "{n} niveaux dans la chaîne d’étude",
  "study.dismissStudyJump": "Quitter la chaîne d’étude",
  "verse.actions": "Actions du verset",
  "verse.passageOptions": "Options",
  "verse.hint": "Tape d’autres versets pour compléter la sélection",
  "verse.hintMulti": "{n} versets · tape pour ajouter ou retirer",
  "verse.selectTitle": "Versets",
  "verse.tabVerse": "Verset",
  "verse.tabRefs": "Référence",
  "verse.mark": "Marquer",
  "verse.unmark": "Démarquer",
  "verse.markDone": "Sélection marquée",
  "verse.unmarkDone": "Marquage retiré",
  "verse.keepOne": "Gardez au moins un verset, ou fermez avec Options",
  "verse.share": "Partager",
  "verse.shareCopied": "Texte copié",
  "verse.shareFailed": "Partage impossible",
  "verse.colorTitle": "Personnaliser la couleur",
  "word.placeholder": "Mot ou expression…",
  "word.aria": "Rechercher un mot ou une expression dans la Bible",
  "word.panel": "Recherche dans la Bible",
  "word.short": "Recherche",
  "word.ot": "Ancien",
  "word.nt": "Nouveau",
  "word.dc": "Deutéro.",
  "word.recents": "RÉCENTS",
  "word.suggestions": "SUGGESTIONS",
  "word.filterBook": "Filtrer un livre…",
  "word.apply": "Appliquer ({n} passages)",
  "word.showAll": "Tout afficher ({n})",
  "word.partial": "{shown} sur {total} passages",
  "word.range": "{start}–{end} sur {total} passages",
  "word.count": "{n} passage(s)",
  "word.pagination": "Pagination des résultats",
  "word.page": "Page {n}",
  "word.empty": "Aucun passage trouvé",
  "word.emptyInBook":
    "Aucun résultat pour « {query} » dans {book}.",
  "word.outsideBook":
    "Aucun passage dans {book}. Affichage hors de ce livre.",
  "word.emptyBooks": "Aucun livre trouvé",
  "word.fuzzy":
    "Aucun résultat exact. Affichage des passages pour des termes proches.",
  "word.or":
    "Aucun verset avec tous les mots. Passages contenant une partie de votre recherche :",
  "word.unavailable": "Recherche indisponible",
};

const HT: Dict = {
  "shell.nav": "Navigasyon",
  "shell.home": "Akèy",
  "shell.plan": "Plan",
  "shell.bible": "Bib",
  "shell.profile": "Pwofil",
  "shell.admin": "Admin",
  "common.close": "Fèmen",
  "common.back": "Tounen",
  "common.clear": "Efase",
  "common.confirm": "Konfime ?",
  "common.cancel": "Anile",
  "common.reload": "Rechaje",
  "common.error": "Gen yon erè ki rive",
  "common.loading": "Ap chaje…",
  "common.book": "Liv",
  "common.chapters": "Chapit",
  "home.greeting.morning": "Bonjou",
  "home.greeting.afternoon": "Bonswa",
  "home.greeting.evening": "Bonswa",
  "home.continue": "Kontinye lekti",
  "home.openBible": "Louvri Bib la",
  "home.dailyVerse": "Vèsè jodi a",
  "home.share": "Pataje",
  "home.plans": "Plan lekti",
  "home.resumePlan": "Rekòmanse",
  "home.discoverPlans": "Dekouvri plan yo",
  "home.read": "Li",
  "home.seeAll": "Wè tout",
  "home.days": "{done}/{total} jou",
  "home.plansEmpty": "Chwazi yon parcours nan onglet Plan la.",
  "home.browsePlans": "Gade plan yo",
  "plan.title": "Plan",
  "plan.discover": "Dekouvri",
  "plan.myPlans": "Plan mwen",
  "plan.findPlans": "Dekouvri",
  "plan.dayOf": "Jou {done} sou {total}",
  "plan.daysCount": "{total} jou",
  "plan.mineEmpty": "Ou poko gen plan an kou.",
  "plan.continue": "Kontinye",
  "plan.review": "Revize",
  "plan.returnAction": "Tounen",
  "plan.returnToPlans": "Plan",
  "plan.stages": "Etap",
  "plan.days": "Jou",
  "plan.today": "Jodi a",
  "plan.dayReading": "Lekti jou a",
  "plan.dayPassage": "Pasaj jou a",
  "plan.empty": "Pa gen plan disponib",
  "plan.resume": "Rekòmanse",
  "plan.start": "Kòmanse",
  "plan.inProgress": "An kou",
  "plan.all": "Tout plan yo",
  "plan.emptyHint": "Parcours gide yo ap parèt isit lè yo pibliye.",
  "plan.emptyPublishedHint":
    "Pa gen parcours pibliye pou kounye a. Verifye koneksyon an oswa eseye ankò.",
  "plan.catalogError": "Katalòg pa disponib",
  "plan.catalogErrorHint": "Pa kapab chaje plan yo pou kounye a.",
  "plan.offline": "Plan offline",
  "plan.offlineHint":
    "Katalòg la pa konfigire sou aparèy sa a. Ou ka toujou louvri Bib la.",
  "plan.retry": "Eseye ankò",
  "plan.firebaseMissing":
    "Firebase pa nan build sa a. Rekompile APK a ak VITE_FIREBASE_* nan .env.",
  "profile.title": "Pwofil",
  "profile.history": "Istorik",
  "profile.clearHistory": "Efase",
  "profile.clearHistoryConfirm": "Konfime ?",
  "profile.signIn": "Konekte",
  "profile.signOut": "Dekonekte",
  "profile.connectAccount": "Konekte yon kont",
  "profile.tab.account": "Kont",
  "profile.tab.prefs": "Preferans",
  "profile.tab.storage": "Depo",
  "profile.tab.history": "Istorik",
  "profile.tab.admin": "Admin",
  "profile.account": "Kont",
  "auth.titleUpgrade": "Sove etid mwen yo",
  "auth.titleSoftGate": "Kenbe souliyman ou yo",
  "auth.leadUpgrade":
    "Konekte ak Google pou senkwonize mak, nòt ak plan ant aparèy ou yo.",
  "auth.leadSoftGate":
    "An mòd envite, ou ka make jiska 10 vèsè sou aparèy sa a. Konekte Google pou kontinye epi jwenn souliyman ou yo tout kote.",
  "auth.google": "Kontinye ak Google",
  "auth.or": "oswa",
  "auth.email": "Imèl",
  "auth.password": "Modpas",
  "auth.signIn": "Konekte",
  "auth.register": "Kreye yon kont",
  "auth.sendLink": "Voye lyen an",
  "auth.createAccount": "Kreye yon kont",
  "auth.forgotPassword": "Modpas bliye ?",
  "auth.backToSignIn": "Retounen nan koneksyon",
  "auth.later": "Pita",
  "auth.resetSent":
    "Imèl reyinisyalizasyon voye. Tcheke bwat resepsyon ou.",
  "auth.errorEmail": "Antre imèl ou.",
  "auth.errorPassword": "Modpas : omwen 6 karaktè.",
  "auth.showPassword": "Montre modpas la",
  "auth.hidePassword": "Kache modpas la",
  "auth.error.generic": "Koneksyon pa posib. Eseye ankò nan yon ti moman.",
  "auth.error.invalidCredential": "Imèl oswa modpas pa kòrèk.",
  "auth.error.wrongPassword": "Modpas pa kòrèk.",
  "auth.error.userNotFound": "Pa gen kont pou imèl sa a.",
  "auth.error.emailInUse": "Imèl sa a deja mare ak yon kont.",
  "auth.error.weakPassword":
    "Modpas twò fèb (omwen 6 karaktè).",
  "auth.error.tooManyRequests":
    "Twòp esè. Eseye ankò pita.",
  "auth.error.network": "Rezo pa disponib. Verifye koneksyon ou.",
  "auth.error.popupClosed": "Koneksyon anile.",
  "auth.error.missingToken":
    "Koneksyon Google pa konplè (jeton manke). Verifye google-services.json nan APK la.",
  "auth.error.nativeConfig":
    "Google Sign-In mal konfigire (SHA-1/256 oswa google-services.json). Verifye Firebase Console.",
  "auth.signOutConfirm":
    "Done senkwonize yo rete an sekirite nan nwaj la epi y ap tounen nan pwochen koneksyon. Y ap retire nan aparèy sa a.",
  "auth.signOutConfirmOffline":
    "Ou offline: modifikasyon ki poko voye yo ka pèdi.",
  "auth.signOutConfirmAction": "Dekonekte nan aparèy sa a",
  "onboarding.welcomeTitle": "Byenveni",
  "onboarding.welcomeLead":
    "Konfime oswa ajiste non ou. Kont ou senkwonize done yo ant aparèy.",
  "onboarding.fullName": "Non konplè",
  "onboarding.errorName": "Antre non konplè ou pou kontinye.",
  "onboarding.submit": "Kontinye",
  "onboarding.cancel": "Anile",
  "toast.offline": "Offline — tout rete anrejistre sou aparèy sa a.",
  "toast.markSaved": "Souliyman anrejistre",
  "profile.theme": "Tèm",
  "profile.settings": "Preferans",
  "profile.appearance": "Aparans",
  "profile.language": "Lang",
  "profile.langFr": "Français",
  "profile.langHt": "Kreyòl",
  "profile.themeLight": "Klè",
  "profile.themeDark": "Fènwa",
  "profile.themeSystem": "Sistèm",
  "profile.storage": "Depo",
  "profile.storageCache": "Cache",
  "profile.download": "Telechaje",
  "profile.ready": "Pare",
  "profile.historyEmpty": "Pa gen lekti anrejistre pou kounye a.",
  "profile.marks": "Souliyman",
  "profile.marksEmpty": "Pa gen vèsè souliye pou kounye a.",
  "profile.calculating": "Ap kalkile…",
  "profile.guestSaveTitle": "Sove etid mwen yo",
  "profile.guestSaveLead":
    "Konekte Google pou senkwonize mak, nòt ak plan ou yo.",
  "profile.quotaHint":
    "{used}/{total} souliyman — konekte yon kont pou kontinye san pwoblèm",
  "profile.saveName": "Anrejistre",
  "profile.connectedAccount": "Kont konekte",
  "profile.group.bible": "Bib",
  "profile.group.reading": "Lekti",
  "profile.group.library": "Bibliyotèk",
  "profile.readingChromeHint":
    "Louvri Bib la yon fwa pou règle vèsyon ak tipografi isit la.",
  "profile.deleteAccount": "Efase kont mwen",
  "profile.deleteAccountConfirm":
    "Bib S21/HT98 yo ap rete sou aparèy la. Done nwaj ak lokal pèsonèl yo ap efase.",
  "profile.deleteAccountAction": "Konfime efasman an",
  "profile.accountNameWithBadge": "{name} (Abòne)",
  "history.title": "Istorik",
  "history.empty": "Pa gen lekti anrejistre pou kounye a.",
  "history.recent": "Chapit ki louvri dènyèman",
  "history.clearAll": "Efase tout",
  "history.clearAllConfirm": "Efase tout istorik lekti a ?",
  "history.delete": "Efase",
  "history.close": "Fèmen istorik la",
  "history.count": "{n} lekti",
  "history.countOne": "{n} lekti",
  "bible.searchWord": "Chèche yon mo nan Bib la",
  "bible.history": "Istorik",
  "bible.prevChapter": "Chapit anvan",
  "bible.nextChapter": "Chapit apre",
  "bible.chapters": "Chapit",
  "bible.chapterN": "Chapit {n}",
  "bible.bookChapter": "Liv ak chapit",
  "bible.nav": "Navigasyon biblik",
  "bible.menu": "Meni",
  "bible.menuBible": "Meni Bib",
  "bible.version": "Vèsyon",
  "bible.versionGroup": "Vèsyon Bib la",
  "bible.tools": "Zouti",
  "bible.offlineReady": "Bib offline",
  "bible.offlineDownload": "Telechaje offline",
  "bible.offlineDownloading": "Ap telechaje… {done}/{total}",
  "bible.offlineBusy":
    "Ap telechaje… {done}/{total} (touché pou anile)",
  "bible.fontSize": "Gwosè tèks",
  "bible.fontSmaller": "Redwi gwosè tèks la",
  "bible.fontLarger": "Ogmante gwosè tèks la",
  "bible.text": "Tèks",
  "bible.planProgress": "Pwogrè plan an",
  "bible.planPrev": "Pasaj anvan nan plan an",
  "bible.planNext": "Pasaj apre nan plan an",
  "bible.planStage": "Etap {n}",
  "bible.planDay": "Jou {n}",
  "bible.audioPlayer": "Lektè odyo",
  "plan.personalNote": "Nòt pèsonèl",
  "plan.personalNoteLead":
    "Nòt pèsonèl — ajoute yon refleksyon (opsyonèl).",
  "plan.personalNoteHint": "Opsyonèl · andeyò parcours lekti a",
  "plan.personalNoteDone": "Ekri",
  "plan.personalNoteSave": "Anrejistre",
  "plan.readerNoteLead":
    "Jou a fini — ajoute yon refleksyon (opsyonèl).",
  "plan.readerNoteLeadStage":
    "Etap la fini — ajoute yon nòt pèsonèl (opsyonèl).",
  "plan.completeTitle": "Plan fini",
  "plan.completeLead":
    "Ou fini tout parcours la. Ou ka li l ankò lè ou vle.",
  "offline.title": "Chapit offline pa disponib",
  "offline.lead":
    "Chapit sa a dwe telechaje pou lekti san koneksyon. Mak ou yo ak pwogrè a rete sou aparèy la.",
  "offline.reconnectTitle": "Koneksyon nesesè pou telechaje",
  "offline.reconnectLead":
    "Vèsyon sa a poko disponib offline. Rekonekte pou telechaje li ; apre sa lekti ak rechèch ap mache san rezo.",
  "offline.downloading": "Ap telechaje…",
  "offline.waiting": "Ap tann koneksyon",
  "offline.downloadCta": "Telechaje Bib la offline",
  "swUpdate.title": "Nouvo vèsyon",
  "swUpdate.lead": "Gen yon mizajou pare pou enstale.",
  "swUpdate.cta": "Mete ajou",
  "pwaInstall.title": "Enstale app Biblos",
  "pwaInstall.lead":
    "Ajoute Biblos nan ekran dakèy pou ouvri li tankou yon aplikasyon.",
  "pwaInstall.apkLead":
    "Telechaje APK Android pou enstale Biblos deyò navigatè a.",
  "pwaInstall.iosLead":
    "Pe Partaje, epi « Ajoute nan Ekran Dakèy ».",
  "pwaInstall.cta": "Enstale app",
  "pwaInstall.apkCta": "Telechaje app (APK)",
  "pwaInstall.busy": "Ap enstale…",
  "searchBooks.title": "Liv",
  "searchBooks.back": "Tounen nan liv yo",
  "searchBooks.close": "Fèmen",
  "searchBooks.placeholder": "Jenèz, Sòm, Jan…",
  "searchBooks.search": "Chèche yon liv",
  "searchBooks.empty": "Pa gen liv",
  "searchBooks.chapters": "Chapit",
  "searchBooks.chAbbr": "{n} ch.",
  "searchBooks.chaptersCount": "{n} chapit",
  "study.title": "Etid",
  "study.close": "Fèmen etid la",
  "study.context": "Kontèks",
  "study.refs": "Referans",
  "study.crossRefs": "Referans kwa",
  "study.application": "Aplikasyon",
  "study.notes": "Nòt",
  "study.tabs": "Seksyon etid",
  "study.notesLabel": "Nòt mwen",
  "study.contextEmpty": "Kontèks istorik pa disponib pou vèsè sa a.",
  "study.appEmpty": "Aplikasyon pratik ap vini pou pasaj sa a.",
  "study.refsEmpty": "Pa gen referans kwa pou vèsè sa a.",
  "study.notesPlaceholder": "Ekri yon nòt pèsonèl…",
  "study.notesSaved": "Anrejistre · sync si konekte",
  "study.notesDraft": "Brouiyon lokal",
  "study.loadError": "Erè chajman",
  "study.refUnavailable": "Tèks pasaj sa a pa disponib pou vèsyon sa a.",
  "study.goToPassage": "Ale nan vèsè a",
  "study.goToChapter": "Ale nan chapit la",
  "study.returnToVerse": "Tounen nan referans yo",
  "study.returnToLabel": "Tounen nan {label}",
  "study.returnAction": "Tounen nan",
  "study.returnStackDepth": "{n} nivo nan chèn etid la",
  "study.dismissStudyJump": "Kite chèn etid la",
  "verse.actions": "Aksyon vèsè",
  "verse.passageOptions": "Options",
  "verse.hint": "Make lòt vèsè pou konplete seleksyon an",
  "verse.hintMulti": "{n} vèsè · make pou ajoute oswa retire",
  "verse.selectTitle": "Vèsè",
  "verse.tabVerse": "Vèsè",
  "verse.tabRefs": "Referans",
  "verse.mark": "Make",
  "verse.unmark": "Demake",
  "verse.markDone": "Seleksyon make",
  "verse.unmarkDone": "Mak retire",
  "verse.keepOne": "Kenbe omwen yon vèsè, oswa fèmen ak Options",
  "verse.share": "Pataje",
  "verse.shareCopied": "Tèks kopye",
  "verse.shareFailed": "Pataj pa posib",
  "verse.colorTitle": "Personnalize koulè a",
  "word.placeholder": "Chèche nan Bib la…",
  "word.aria": "Chèche yon mo oswa yon ekspresyon nan Bib la",
  "word.panel": "Rechèch nan Bib la",
  "word.short": "Rechèch",
  "word.ot": "Ansyen",
  "word.nt": "Nouvo",
  "word.dc": "Dewoterokanonik",
  "word.recents": "RESAN",
  "word.suggestions": "SIJESYON",
  "word.filterBook": "Filtre yon liv…",
  "word.apply": "Aplike ({n} pasaj)",
  "word.showAll": "Montre tout ({n})",
  "word.partial": "{shown} sou {total} pasaj",
  "word.range": "{start}–{end} sou {total} pasaj",
  "word.count": "{n} pasaj",
  "word.pagination": "Pajinasyon rezilta yo",
  "word.page": "Paj {n}",
  "word.empty": "Pa gen pasaj jwenn",
  "word.emptyInBook":
    "Pa gen rezilta pou « {query} » nan {book}.",
  "word.outsideBook":
    "Pa gen pasaj nan {book}. Nou montre rezilta deyò liv sa a.",
  "word.emptyBooks": "Pa gen liv jwenn",
  "word.fuzzy":
    "Pa gen rezilta egzak. Nou montre pasaj pou mo ki sanble.",
  "word.or":
    "Pa gen vèsè ak tout mo yo. Pasaj ki gen yon pati nan rechèch ou a:",
  "word.unavailable": "Rechèch pa disponib",
};

const TABLES: Record<UiLocale, Dict> = { fr: FR, ht: HT };

export function uiCopy(locale: UiLocale): Dict {
  return TABLES[locale] ?? FR;
}

export function formatUiCopy(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(vars[key] ?? `{${key}}`),
  );
}
