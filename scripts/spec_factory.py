import yaml
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any, Union

# --- DSL Model Components ---

@dataclass
class AtomicAction:
    id: str
    label: str
    icon: Optional[str] = None
    action: Optional[Dict[str, Any]] = None
    onAction: Optional[Dict[str, Any]] = None  # DSL compatibility

@dataclass
class UIPart:
    type: str = "text" # Default
    kind: Optional[str] = None # Alternative key in DSL
    label: Optional[str] = None
    value: Optional[Union[str, Dict[str, Any]]] = None
    variant: Optional[str] = None
    placeholder: Optional[str] = None
    guard: Optional[str] = None
    action: Optional[Dict[str, Any]] = None
    onAction: Optional[Dict[str, Any]] = None
    options: Optional[List[Dict[str, str]]] = None # For select-input
    parts: Optional[Dict[str, 'UIPart']] = None # Nested parts (Recursive)

@dataclass
class UIStep:
    title: str
    parts: Dict[str, UIPart] = field(default_factory=dict)

@dataclass
class SecurityFeature:
    id: str
    label: str
    description: Optional[str] = None
    keys: List[str] = field(default_factory=list)

@dataclass
class SecurityGuard:
    id: str
    features: List[Dict[str, Any]] = field(default_factory=list)
    operator: str = "OR"
    matchers: List[Dict[str, str]] = field(default_factory=lambda: [{"type": "matchAlways"}])

@dataclass
class DomainObjectConfig:
    strategyId: str = "LOCAL_STRATEGY"
    label: Optional[str] = None
    limesPrefix: Optional[str] = None
    properties: Dict[str, str] = field(default_factory=dict)
    actions: List[AtomicAction] = field(default_factory=list)

@dataclass
class DomainObjectSpec:
    id: str
    label: str
    version: str = "1.0.0"
    metadata: Dict[str, str] = field(default_factory=dict)
    domainObject: Optional[DomainObjectConfig] = None
    ui: Dict[str, Any] = field(default_factory=dict)
    permissionKeys: Dict[str, Dict[str, str]] = field(default_factory=dict)
    features: Dict[str, SecurityFeature] = field(default_factory=dict)
    capabilities: List[Any] = field(default_factory=list)
    guards: List[SecurityGuard] = field(default_factory=list)

    def to_dict(self):
        """Converts the model to a clean dictionary for YAML serialization, removing None values."""
        def clean_dict(obj):
            if isinstance(obj, dict):
                return {k: clean_dict(v) for k, v in obj.items() if v is not None}
            elif isinstance(obj, list):
                return [clean_dict(x) for x in obj]
            elif hasattr(obj, '__dict__'):
                return clean_dict(asdict(obj))
            else:
                return obj
        return clean_dict(self)

    def to_yaml(self, file_path: Optional[str] = None):
        """Serializes the specification to YAML format."""
        data = self.to_dict()
        yaml_str = yaml.dump(data, sort_keys=False, allow_unicode=True, default_flow_style=False)
        
        if file_path:
            with open(file_path, 'w') as f:
                f.write(yaml_str)
        return yaml_str

# --- Factory / Helper Logic ---

class SpecFactory:
    """Agent-friendly API for building Domain Object Specifications."""
    
    @staticmethod
    def create_action_nav(label: str, target_step: str, variant: str = "primary") -> UIPart:
        return UIPart(
            kind="action",
            label=label,
            variant=variant,
            action={"call": "step.navigate", "params": {"target": target_step}}
        )

    @staticmethod
    def create_text_input(label: str, placeholder: str = "") -> UIPart:
        return UIPart(kind="text-input", label=label, placeholder=placeholder)

    @staticmethod
    def create_card(label: str, parts: Dict[str, UIPart], variant: str = "default") -> UIPart:
        return UIPart(type="card", label=label, variant=variant, parts=parts)

# --- Smoke Test / Usage Example ---

if __name__ == "__main__":
    # Example: Creating a simple blueprint via the factory
    spec = DomainObjectSpec(
        id="generated-flow",
        label="Generated Flow 🏛️",
        metadata={"name": "Generated Flow", "description": "Constructed via SDN-0001 Spec Factory."}
    )
    
    # 1. Domain Config
    spec.domainObject = DomainObjectConfig(
        strategyId="LOCAL_STRATEGY",
        limesPrefix="GEN",
        actions=[AtomicAction(id="view", label="Open Flow", icon="fas fa-play")]
    )
    
    # 2. UI Steps
    welcome_parts = {
        "welcome_card": SpecFactory.create_card(
            label="Getting Started",
            parts={
                "intro": UIPart(type="text", value="This flow was generated programmatically!"),
                "start_btn": SpecFactory.create_action_nav("Launch Process", "form_step")
            }
        )
    }
    
    form_parts = {
        "user_data": SpecFactory.create_card(
            label="User Identity",
            parts={
                "username": SpecFactory.create_text_input("Username", "e.g. agent_smith"),
                "back": SpecFactory.create_action_nav("Cancel", "welcome", variant="danger")
            }
        )
    }
    
    spec.ui = {
        "initialStep": "welcome",
        "steps": {
            "welcome": {"title": "Welcome", "parts": welcome_parts},
            "form_step": {"title": "Setup", "parts": form_parts}
        }
    }
    
    print("--- Generated Spec YAML ---")
    print(spec.to_yaml())
