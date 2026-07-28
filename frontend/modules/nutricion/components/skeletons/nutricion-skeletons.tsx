import {
  FormPageSkeleton,
  ListPageSkeleton,
  ModuleHomeSkeleton,
} from "@/components/feedback/loaders/route-skeletons"

export function NutricionHomeSkeleton() {
  return <ModuleHomeSkeleton module="nutricion" />
}

export function NutricionListSkeleton() {
  return <ListPageSkeleton module="nutricion" />
}

export function NutricionFormSkeleton() {
  return <FormPageSkeleton module="nutricion" />
}
