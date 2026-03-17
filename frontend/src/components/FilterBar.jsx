import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const FilterBar = ({ filters, onChange }) => {
  return (
    <div className="flex flex-wrap gap-3 items-center" data-testid="filter-bar">
      <Select
        value={filters.region}
        onValueChange={(v) => onChange({ ...filters, region: v })}
      >
        <SelectTrigger
          className="w-[130px] h-9 bg-secondary/50 border-white/10 text-xs font-mono"
          data-testid="filter-region"
        >
          <SelectValue placeholder="Region" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Regions</SelectItem>
          <SelectItem value="North America">North America</SelectItem>
          <SelectItem value="South America">South America</SelectItem>
          <SelectItem value="Europe">Europe</SelectItem>
          <SelectItem value="Middle East">Middle East</SelectItem>
          <SelectItem value="Africa">Africa</SelectItem>
          <SelectItem value="Asia">Asia</SelectItem>
          <SelectItem value="Oceania">Oceania</SelectItem>
          <SelectItem value="OCE">Oceania</SelectItem>
          <SelectItem value="SA">South America</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.status}
        onValueChange={(v) => onChange({ ...filters, status: v })}
      >
        <SelectTrigger
          className="w-[140px] h-9 bg-secondary/50 border-white/10 text-xs font-mono"
          data-testid="filter-status"
        >
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="filling">Filling</SelectItem>
          <SelectItem value="almost_full">Almost Full</SelectItem>
          <SelectItem value="starting">Starting</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
