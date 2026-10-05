import {
  Alert02Icon as Alert02IconData,
  AlertCircleIcon as AlertCircleIconData,
  ArrowDown01Icon as ArrowDown01IconData,
  ArrowDown02Icon as ArrowDown02IconData,
  ArrowLeft01Icon as ArrowLeft01IconData,
  ArrowLeft02Icon as ArrowLeft02IconData,
  ArrowRight01Icon as ArrowRight01IconData,
  ArrowRight02Icon as ArrowRight02IconData,
  ArrowUp01Icon as ArrowUp01IconData,
  ArrowUp02Icon as ArrowUp02IconData,
  ArrowUpDownIcon as ArrowUpDownIconData,
  AudioLinesIcon as AudioLinesIconData,
  BellIcon as BellIconData,
  BotIcon as BotIconData,
  BubbleChatIcon as BubbleChatIconData,
  Camera01Icon as Camera01IconData,
  Cancel01Icon as Cancel01IconData,
  CancelCircleIcon as CancelCircleIconData,
  CheckIcon as CheckIconData,
  CircleArrowUp02Icon as CircleArrowUp02IconData,
  CircleCheckIcon as CircleCheckIconData,
  CircleDashedIcon as CircleDashedIconData,
  CircleQuestionMarkIcon as CircleQuestionMarkIconData,
  ClapperboardIcon as ClapperboardIconData,
  ClipboardCheckIcon as ClipboardCheckIconData,
  Clock01Icon as Clock01IconData,
  CopyIcon as CopyIconData,
  CornerDownLeftIcon as CornerDownLeftIconData,
  Delete02Icon as Delete02IconData,
  Download04Icon as Download04IconData,
  Edit01Icon as Edit01IconData,
  Edit02Icon as Edit02IconData,
  EllipsisIcon as EllipsisIconData,
  ExternalLinkIcon as ExternalLinkIconData,
  EyeIcon as EyeIconData,
  File01Icon as File01IconData,
  FileArchiveIcon as FileArchiveIconData,
  FileAudioIcon as FileAudioIconData,
  FileImageIcon as FileImageIconData,
  FilePlusIcon as FilePlusIconData,
  FileTextIcon as FileTextIconData,
  FileTypeIcon as FileTypeIconData,
  FileUnknownIcon as FileUnknownIconData,
  FileVideoIcon as FileVideoIconData,
  Film01Icon as Film01IconData,
  FocusIcon as FocusIconData,
  Folder01Icon as Folder01IconData,
  FolderDownIcon as FolderDownIconData,
  FolderOpenIcon as FolderOpenIconData,
  FolderPlusIcon as FolderPlusIconData,
  FolderSearchIcon as FolderSearchIconData,
  GlobeIcon as GlobeIconData,
  GraduationCapIcon as GraduationCapIconData,
  HandIcon as HandIconData,
  Image01Icon as Image01IconData,
  ImagePlusIcon as ImagePlusIconData,
  InfoIcon as InfoIconData,
  KeyboardIcon as KeyboardIconData,
  KeyRoundIcon as KeyRoundIconData,
  Layers01Icon as Layers01IconData,
  LightbulbIcon as LightbulbIconData,
  ListPlusIcon as ListPlusIconData,
  ListTodoIcon as ListTodoIconData,
  Loading03Icon as Loading03IconData,
  LockKeyholeIcon as LockKeyholeIconData,
  Mail01Icon as Mail01IconData,
  Maximize01Icon as Maximize01IconData,
  MinimizeIcon as MinimizeIconData,
  MinusIcon as MinusIconData,
  MonitorPlayIcon as MonitorPlayIconData,
  MoreHorizontalIcon as MoreHorizontalIconData,
  MousePointerClickIcon as MousePointerClickIconData,
  MusicIcon as MusicIconData,
  MusicNote01Icon as MusicNote01IconData,
  NotebookIcon as NotebookIconData,
  NotebookPenIcon as NotebookPenIconData,
  PanelLeftCloseIcon as PanelLeftCloseIconData,
  PanelLeftIcon as PanelLeftIconData,
  PanelLeftOpenIcon as PanelLeftOpenIconData,
  PanelRightCloseIcon as PanelRightCloseIconData,
  PanelRightOpenIcon as PanelRightOpenIconData,
  PauseIcon as PauseIconData,
  PencilIcon as PencilIconData,
  PlayIcon as PlayIconData,
  PlugZapIcon as PlugZapIconData,
  PlusIcon as PlusIconData,
  QuoteIcon as QuoteIconData,
  RefreshCwIcon as RefreshCwIconData,
  RocketIcon as RocketIconData,
  RotateCcwIcon as RotateCcwIconData,
  RotateCwIcon as RotateCwIconData,
  RulerIcon as RulerIconData,
  ScrollTextIcon as ScrollTextIconData,
  Search01Icon as Search01IconData,
  Settings01Icon as Settings01IconData,
  Shield01Icon as Shield01IconData,
  SlidersHorizontalIcon as SlidersHorizontalIconData,
  SmartphoneIcon as SmartphoneIconData,
  SourceCodeIcon as SourceCodeIconData,
  SparklesIcon as SparklesIconData,
  SquareDashedIcon as SquareDashedIconData,
  SquareIcon as SquareIconData,
  StepBackIcon as StepBackIconData,
  StepForwardIcon as StepForwardIconData,
  SunMoonIcon as SunMoonIconData,
  Tag01Icon as Tag01IconData,
  TerminalIcon as TerminalIconData,
  TimeQuarter02Icon as TimeQuarter02IconData,
  TriangleAlertIcon as TriangleAlertIconData,
  UnfoldLessIcon as UnfoldLessIconData,
  UnfoldMoreIcon as UnfoldMoreIconData,
  Upload04Icon as Upload04IconData,
  Video01Icon as Video01IconData,
  VolumeHighIcon as VolumeHighIconData,
  VolumeXIcon as VolumeXIconData,
  Wrench01Icon as Wrench01IconData,
  ZoomInIcon as ZoomInIconData,
  ZoomOutIcon as ZoomOutIconData,
} from "@hugeicons/core-free-icons";
import {
  HugeiconsIcon,
  type HugeiconsIconProps,
  type IconSvgElement,
} from "@hugeicons/react";

export type IconProps = Omit<HugeiconsIconProps, "icon">;
export type Icon = ReturnType<typeof studioIcon>;

// One stroke and size contract for application icons; platform marks stay separate.
function studioIcon(icon: IconSvgElement) {
  return function StudioIcon(props: IconProps) {
    return (
      <HugeiconsIcon
        aria-hidden={
          props["aria-label"] || props["aria-labelledby"] ? undefined : true
        }
        icon={icon}
        size={16}
        strokeWidth={1.5}
        {...props}
      />
    );
  };
}

export const AlertTriangleIcon = studioIcon(Alert02IconData);
export const ArrowDownIcon = studioIcon(ArrowDown02IconData);
export const ArrowLeftIcon = studioIcon(ArrowLeft02IconData);
export const ArrowRightIcon = studioIcon(ArrowRight02IconData);
export const ArrowUpCircleIcon = studioIcon(CircleArrowUp02IconData);
export const ArrowUpIcon = studioIcon(ArrowUp02IconData);
export const AudioLinesIcon = studioIcon(AudioLinesIconData);
export const BellIcon = studioIcon(BellIconData);
export const BotIcon = studioIcon(BotIconData);
export const CameraIcon = studioIcon(Camera01IconData);
export const CheckIcon = studioIcon(CheckIconData);
export const ChevronDownIcon = studioIcon(ArrowDown01IconData);
export const ChevronLeftIcon = studioIcon(ArrowLeft01IconData);
export const ChevronRight = studioIcon(ArrowRight01IconData);
export const ChevronRightIcon = studioIcon(ArrowRight01IconData);
export const ChevronUpIcon = studioIcon(ArrowUp01IconData);
export const ChevronsUpDownIcon = studioIcon(ArrowUpDownIconData);
export const CircleAlertIcon = studioIcon(AlertCircleIconData);
export const CircleArrowUpIcon = studioIcon(CircleArrowUp02IconData);
export const CircleCheckIcon = studioIcon(CircleCheckIconData);
export const CircleDashedIcon = studioIcon(CircleDashedIconData);
export const CircleQuestionMarkIcon = studioIcon(CircleQuestionMarkIconData);
export const ClapperboardIcon = studioIcon(ClapperboardIconData);
export const ClipboardCheckIcon = studioIcon(ClipboardCheckIconData);
export const ClockIcon = studioIcon(Clock01IconData);
export const ComponentIcon = studioIcon(Layers01IconData);
export const CopyIcon = studioIcon(CopyIconData);
export const CornerDownLeftIcon = studioIcon(CornerDownLeftIconData);
export const DownloadIcon = studioIcon(Download04IconData);
export const EllipsisIcon = studioIcon(EllipsisIconData);
export const ExternalLinkIcon = studioIcon(ExternalLinkIconData);
export const EyeIcon = studioIcon(EyeIconData);
export const FileArchiveIcon = studioIcon(FileArchiveIconData);
export const FileAudioIcon = studioIcon(FileAudioIconData);
export const FileCode2Icon = studioIcon(SourceCodeIconData);
export const FileIcon = studioIcon(File01IconData);
export const FileImageIcon = studioIcon(FileImageIconData);
export const FilePlusIcon = studioIcon(FilePlusIconData);
export const FileQuestionIcon = studioIcon(FileUnknownIconData);
export const FileTextIcon = studioIcon(FileTextIconData);
export const FileTypeIcon = studioIcon(FileTypeIconData);
export const FileVideoIcon = studioIcon(FileVideoIconData);
export const FilmIcon = studioIcon(Film01IconData);
export const FocusIcon = studioIcon(FocusIconData);
export const FolderDownIcon = studioIcon(FolderDownIconData);
export const FolderIcon = studioIcon(Folder01IconData);
export const FolderOpenIcon = studioIcon(FolderOpenIconData);
export const FolderPlusIcon = studioIcon(FolderPlusIconData);
export const FolderSearchIcon = studioIcon(FolderSearchIconData);
export const GlobeIcon = studioIcon(GlobeIconData);
export const GraduationCapIcon = studioIcon(GraduationCapIconData);
export const HandIcon = studioIcon(HandIconData);
export const ImageIcon = studioIcon(Image01IconData);
export const ImagePlusIcon = studioIcon(ImagePlusIconData);
export const InfoIcon = studioIcon(InfoIconData);
export const KeyRoundIcon = studioIcon(KeyRoundIconData);
export const KeyboardIcon = studioIcon(KeyboardIconData);
export const LayersIcon = studioIcon(Layers01IconData);
export const LibraryBigIcon = studioIcon(Image01IconData);
export const LightbulbIcon = studioIcon(LightbulbIconData);
export const ListPlusIcon = studioIcon(ListPlusIconData);
export const ListTodoIcon = studioIcon(ListTodoIconData);
export const Loader2Icon = studioIcon(Loading03IconData);
export const LoaderCircleIcon = studioIcon(Loading03IconData);
export const LockKeyholeIcon = studioIcon(LockKeyholeIconData);
export const MailIcon = studioIcon(Mail01IconData);
export const MaximizeIcon = studioIcon(Maximize01IconData);
export const MessageSquareIcon = studioIcon(BubbleChatIconData);
export const MinimizeIcon = studioIcon(MinimizeIconData);
export const MinusIcon = studioIcon(MinusIconData);
export const MonitorPlayIcon = studioIcon(MonitorPlayIconData);
export const MoreHorizontal = studioIcon(MoreHorizontalIconData);
export const MoreHorizontalIcon = studioIcon(MoreHorizontalIconData);
export const MousePointerClickIcon = studioIcon(MousePointerClickIconData);
export const Music2Icon = studioIcon(MusicNote01IconData);
export const MusicIcon = studioIcon(MusicIconData);
export const NotebookIcon = studioIcon(NotebookIconData);
export const NotebookPenIcon = studioIcon(NotebookPenIconData);
export const PanelLeftCloseIcon = studioIcon(PanelLeftCloseIconData);
export const PanelLeftIcon = studioIcon(PanelLeftIconData);
export const PanelLeftOpenIcon = studioIcon(PanelLeftOpenIconData);
export const PanelRightCloseIcon = studioIcon(PanelRightCloseIconData);
export const PanelRightOpenIcon = studioIcon(PanelRightOpenIconData);
export const PauseIcon = studioIcon(PauseIconData);
export const PencilIcon = studioIcon(PencilIconData);
export const PencilLineIcon = studioIcon(Edit02IconData);
export const PlayIcon = studioIcon(PlayIconData);
export const PlugZapIcon = studioIcon(PlugZapIconData);
export const PlusIcon = studioIcon(PlusIconData);
export const QuoteIcon = studioIcon(QuoteIconData);
export const RefreshCwIcon = studioIcon(RefreshCwIconData);
export const RocketIcon = studioIcon(RocketIconData);
export const RotateCcwIcon = studioIcon(RotateCcwIconData);
export const RotateCwIcon = studioIcon(RotateCwIconData);
export const RulerIcon = studioIcon(RulerIconData);
export const ScrollTextIcon = studioIcon(ScrollTextIconData);
export const SearchIcon = studioIcon(Search01IconData);
export const SettingsIcon = studioIcon(Settings01IconData);
export const ShieldIcon = studioIcon(Shield01IconData);
export const SlidersHorizontalIcon = studioIcon(SlidersHorizontalIconData);
export const SmartphoneIcon = studioIcon(SmartphoneIconData);
export const SparklesIcon = studioIcon(SparklesIconData);
export const SquareDashedIcon = studioIcon(SquareDashedIconData);
export const SquareIcon = studioIcon(SquareIconData);
export const SquarePenIcon = studioIcon(Edit01IconData);
export const StepBackIcon = studioIcon(StepBackIconData);
export const StepForwardIcon = studioIcon(StepForwardIconData);
export const SunMoonIcon = studioIcon(SunMoonIconData);
export const TagIcon = studioIcon(Tag01IconData);
export const TerminalIcon = studioIcon(TerminalIconData);
export const TimeQuarter02Icon = studioIcon(TimeQuarter02IconData);
export const Trash2Icon = studioIcon(Delete02IconData);
export const TriangleAlertIcon = studioIcon(TriangleAlertIconData);
export const UnfoldLessIcon = studioIcon(UnfoldLessIconData);
export const UnfoldMoreIcon = studioIcon(UnfoldMoreIconData);
export const UploadIcon = studioIcon(Upload04IconData);
export const VideoIcon = studioIcon(Video01IconData);
export const Volume2Icon = studioIcon(VolumeHighIconData);
export const VolumeXIcon = studioIcon(VolumeXIconData);
export const WrenchIcon = studioIcon(Wrench01IconData);
export const XCircleIcon = studioIcon(CancelCircleIconData);
export const XIcon = studioIcon(Cancel01IconData);

export const ZoomInIcon = studioIcon(ZoomInIconData);
export const ZoomOutIcon = studioIcon(ZoomOutIconData);
