import {
  ActiveSessionSkeleton,
  FormPageSkeleton,
  ListPageSkeleton,
  ModuleHomeSkeleton,
} from "@/components/feedback/loaders/route-skeletons"

export function EntrenamientosHomeSkeleton() {
  return <ModuleHomeSkeleton module="entrenamientos" />
}

export function EntrenamientosListSkeleton() {
  return <ListPageSkeleton module="entrenamientos" />
}

export function EntrenamientosFormSkeleton() {
  return <FormPageSkeleton module="entrenamientos" />
}

export function EntrenamientoActivoSkeleton() {
  return <ActiveSessionSkeleton />
}
