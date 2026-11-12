export {
  ConsumerAuthProvider,
  useConsumerAuth,
  type AuthSessionState,
} from "./presentation/hooks/useConsumerAuth";
export { SignInModal } from "./presentation/SignInModal";
export { ProfileOnboarding } from "./presentation/ProfileOnboarding";
export {
  isConsumerAuthConfigured,
  type ConsumerAuthUser,
} from "./data/consumerFirebaseAuth";
